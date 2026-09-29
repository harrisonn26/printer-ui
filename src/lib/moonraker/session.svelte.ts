// Connection lifecycle, modelled on Fluidd's socket state machine
// (src/store/socket/actions.ts), GPL-3.0:
//
//   initializing → {connecting | disconnected} → identifying → {ready | authenticating}
//
// Every transition goes through #setStatus, which validates the edge and runs
// the destination's side-effects.

import { MoonrakerSocket } from './socket'
import { PrinterObjects } from './printer.svelte'
import { ConsoleLog } from './console.svelte'
import { ThermalHistory, type Reading } from './thermals.svelte'
import { sensorKeys } from '../sensors'
import { errorMessage, isNotFoundError, isSocketError, isUnauthorizedError } from './errors'
import { clearTokens, getAccessToken, saveTokens } from './tokens'
import { normalizeMoonrakerUrl, resolveMoonrakerUrl, saveMoonrakerUrl } from '../config'
import { toasts } from '../toasts.svelte'

export type SessionStatus =
  | 'initializing'
  | 'disconnected'
  | 'connecting'
  | 'identifying'
  | 'authenticating'
  | 'ready'

export type KlippyState = Moonraker.Server.KlippyState | 'unknown'

const VALID_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  initializing: ['connecting', 'disconnected'],
  disconnected: ['connecting'],
  connecting: ['disconnected', 'identifying'],
  identifying: ['disconnected', 'connecting', 'authenticating', 'ready'],
  authenticating: ['disconnected', 'connecting', 'identifying'],
  ready: ['disconnected', 'connecting', 'authenticating']
}

// Klippy states it leaves on its own; the others need a restart, which
// Moonraker announces with notify_klippy_disconnected.
const KLIPPY_TRANSIENT: readonly KlippyState[] = ['startup', 'disconnected']
const KLIPPY_RETRY_MS = 1500

class Session {
  status = $state<SessionStatus>('initializing')
  url = $state('')
  /** Reconnect attempt, and the delay before it; null while not retrying. */
  retry = $state<{ attempt: number, delay: number } | null>(null)
  user = $state.raw<Moonraker.Authorization.GetUserResponse | null>(null)
  authInfo = $state.raw<Moonraker.Authorization.InfoResponse | null>(null)
  server = $state.raw<Moonraker.Server.InfoResponse | null>(null)
  klippy = $state.raw<{ state: KlippyState, message: string }>({ state: 'unknown', message: '' })
  /** The printer host's own name, from printer.info; kept across Klippy restarts. */
  hostname = $state<string | null>(null)
  readonly printer = new PrinterObjects()
  readonly console = new ConsoleLog()
  readonly thermals = new ThermalHistory()
  webcams = $state.raw<Moonraker.Webcam.Entry[]>([])

  ready = $derived(this.status === 'ready')
  klippyReady = $derived(this.status === 'ready' && this.klippy.state === 'ready')
  /** A real login. Trusted clients and API keys come back as `_TRUSTED_USER_` / `_API_KEY_USER_`. */
  namedUser = $derived(this.user && !this.user.username.startsWith('_') ? this.user : null)

  // server.connection.identify is one-shot per socket.
  #identified = false
  #klippyTimer: ReturnType<typeof setTimeout> | null = null
  #sampleTimer: ReturnType<typeof setInterval> | null = null
  // Bumped by every start/stop, so a store fetch that outlives a reset is dropped.
  #thermalRun = 0

  #socket = new MoonrakerSocket({
    onOpen: () => {
      this.retry = null
      this.#setStatus('identifying')
    },
    onClose: delay => {
      this.retry = { attempt: this.#socket.attempt, delay }
      this.#setStatus('connecting')
    },
    onNotify: (method, params) => this.#onNotify(method, params),
    onStatusUpdate: update => this.printer.apply(update),
    onFastUpdate: (key, value) => this.printer.apply({ [key]: value })
  })

  async start (): Promise<void> {
    document.addEventListener('visibilitychange', () => {
      // Mobile browsers kill sockets in background tabs; don't make the user
      // wait out the backoff when they come back.
      if (document.visibilityState === 'visible' && this.status === 'connecting') {
        this.#socket.retryNow()
      }
    })

    this.connect(await resolveMoonrakerUrl())
  }

  /** Connect to a new URL, as typed by the user or resolved at startup. */
  connect (input: string, persist = false): boolean {
    const url = normalizeMoonrakerUrl(input, location.protocol === 'https:')
    if (persist) saveMoonrakerUrl(url)

    this.#socket.close()
    this.#resetLive()
    this.url = url ?? ''
    this.retry = null

    if (!url) {
      this.#setStatus('disconnected')
      return false
    }

    this.#setStatus('connecting')
    this.#socket.connect(url)
    return true
  }

  disconnect (): void {
    this.#socket.close()
    this.#resetLive()
    this.#setStatus('disconnected')
  }

  call<T> (method: string, params?: Record<string, unknown>): Promise<T> {
    return this.#socket.call<T>(method, params)
  }

  /** Run a user-initiated call, surfacing any failure as a toast. */
  async run<T> (method: string, params?: Record<string, unknown>): Promise<T | undefined> {
    try {
      return await this.call<T>(method, params)
    } catch (error) {
      toasts.push(errorMessage(error), 'error')
      return undefined
    }
  }

  /**
   * Send G-code as the user: echoed to the console, failures surfaced as a
   * toast and a console error. Resolves true when Klipper accepted it.
   */
  async sendGcode (script: string): Promise<boolean> {
    this.console.push(script, 'command')
    try {
      await this.call('printer.gcode.script', { script })
      return true
    } catch (error) {
      const message = errorMessage(error)
      // Klipper's own errors already reach the console as `!! …` responses.
      if (!isSocketError(error)) this.console.push(`!! ${message}`, 'response')
      toasts.push(message, 'error')
      return false
    }
  }

  async login (username: string, password: string, source?: string): Promise<void> {
    const response = await this.call<Moonraker.Authorization.LoginResponse>('access.login', {
      username,
      password,
      source: source ?? this.authInfo?.default_source ?? 'moonraker'
    })
    saveTokens(this.url, response)
    this.#setStatus('identifying')
  }

  async logout (): Promise<void> {
    try {
      await this.call('access.logout')
    } catch {
      // Already logged out server-side, or no [authorization] component.
    }
    await this.#afterLogout()
  }

  #setStatus (next: SessionStatus): void {
    const prev = this.status
    if (prev === next) return
    if (!VALID_TRANSITIONS[prev].includes(next)) {
      console.warn(`[session] invalid transition ${prev} → ${next}`)
      return
    }
    this.status = next

    switch (next) {
      case 'connecting':
        this.#identified = false
        if (prev === 'ready') this.#resetLive()
        break
      case 'identifying':
        void this.#identify()
        break
    }
  }

  async #identify (): Promise<void> {
    if (!this.#identified) {
      const accessToken = await getAccessToken(
        this.url,
        refresh_token => this.call('access.refresh_jwt', { refresh_token })
      )
      if (this.status !== 'identifying') return

      try {
        await this.call('server.connection.identify', {
          client_name: 'printer-ui',
          version: __APP_VERSION__,
          type: 'web',
          url: location.origin,
          ...(accessToken ? { access_token: accessToken } : {})
        })
        this.#identified = true
      } catch (error) {
        if (this.status !== 'identifying') return
        // A Moonraker old enough to predate identify: carry on unidentified.
        if (!isNotFoundError(error)) {
          await this.#enterAuthenticating()
          return
        }
      }
    }

    try {
      this.user = await this.call<Moonraker.Authorization.GetUserResponse>('access.get_user')
    } catch {
      // No [authorization] component, or an anonymous trusted client.
      this.user = null
    }
    if (this.status !== 'identifying') return

    try {
      await this.#refreshKlippy()
    } catch (error) {
      if (this.status !== 'identifying') return
      if (isUnauthorizedError(error)) {
        await this.#enterAuthenticating()
        return
      }
      // Anything else is transient; the klippy poll picks it back up.
      console.debug('[session] bootstrap failed', error)
    }
    if (this.status !== 'identifying') return

    this.#loadConsole()
    this.#loadWebcams()
    this.#setStatus('ready')
  }

  #loadWebcams (): void {
    this.call<Moonraker.Webcam.ListResponse>('server.webcams.list')
      .then(response => this.#setWebcams(response.webcams))
      .catch(() => { this.webcams = [] })
  }

  #setWebcams (webcams: Moonraker.Webcam.Entry[]): void {
    this.webcams = webcams.filter(webcam => webcam.enabled !== false)
  }

  /** Seed the chart from Moonraker's store, then sample live values each second. */
  async #startThermals (): Promise<void> {
    this.#stopThermals()
    const run = this.#thermalRun
    let store: Moonraker.DataStore.TemperatureStoreResponse | null = null
    try {
      store = await this.call<Moonraker.DataStore.TemperatureStoreResponse>('server.temperature_store')
    } catch {
      // No history available: the chart starts from now.
    }
    if (run !== this.#thermalRun) return

    if (store) this.thermals.load(store)
    else this.thermals.clear()
    this.#sampleTimer = setInterval(() => this.#sampleThermals(), 1000)
  }

  #stopThermals (): void {
    this.#thermalRun++
    if (this.#sampleTimer) clearInterval(this.#sampleTimer)
    this.#sampleTimer = null
  }

  #sampleThermals (): void {
    const readings = new Map<string, Reading>()
    for (const key of sensorKeys(this.printer.get('heaters'))) {
      const object = this.printer.raw(key)
      const temperature = object?.temperature
      const target = object?.target
      readings.set(key, {
        temperature: typeof temperature === 'number' ? temperature : undefined,
        target: typeof target === 'number' ? target : undefined
      })
    }
    this.thermals.sample(readings)
  }

  #loadConsole (): void {
    this.call<Moonraker.DataStore.GcodeStoreResponse>('server.gcode_store', { count: 200 })
      .then(response => this.console.load(response.gcode_store))
      .catch(() => {
        // Older Moonraker, or the store is disabled: start with an empty console.
      })
  }

  async #enterAuthenticating (): Promise<void> {
    try {
      this.authInfo = await this.call<Moonraker.Authorization.InfoResponse>('access.info')
    } catch {
      this.authInfo = null
    }
    if (this.status === 'identifying' || this.status === 'ready') {
      this.#setStatus('authenticating')
    }
  }

  /** A trusted client that isn't forced to log in stays connected as itself. */
  async #afterLogout (): Promise<void> {
    clearTokens(this.url)
    this.user = null

    try {
      const info = await this.call<Moonraker.Authorization.InfoResponse>('access.info')
      if (info.trusted && !info.login_required) return
    } catch {
      // Fall through to the login screen.
    }
    await this.#enterAuthenticating()
  }

  async #refreshKlippy (): Promise<void> {
    this.#clearKlippyTimer()

    const info = await this.call<Moonraker.Server.InfoResponse>('server.info')
    this.server = info

    const state: KlippyState = info.klippy_connected ? info.klippy_state : 'disconnected'
    let message = ''
    try {
      const printerInfo = await this.call<Moonraker.KlippyApis.InfoResponse>('printer.info')
      if (state !== 'ready') message = printerInfo.state_message.trim()
      if (printerInfo.hostname) this.hostname = printerInfo.hostname
    } catch {
      // printer.info is unavailable while Klippy is disconnected.
    }
    this.klippy = { state, message }

    if (state === 'ready') {
      await this.#subscribe()
    } else if (KLIPPY_TRANSIENT.includes(state)) {
      this.#scheduleKlippyRefresh()
    }
  }

  #scheduleKlippyRefresh (): void {
    this.#clearKlippyTimer()
    this.#klippyTimer = setTimeout(() => {
      this.#klippyTimer = null
      if (this.status !== 'ready' && this.status !== 'identifying') return
      this.#refreshKlippy().catch(() => this.#scheduleKlippyRefresh())
    }, KLIPPY_RETRY_MS)
  }

  #clearKlippyTimer (): void {
    if (this.#klippyTimer) clearTimeout(this.#klippyTimer)
    this.#klippyTimer = null
  }

  async #subscribe (): Promise<void> {
    const { objects } = await this.call<Moonraker.KlippyApis.ObjectsListResponse>('printer.objects.list')
    const response = await this.call<Moonraker.KlippyApis.ObjectsSubscribeResponse>(
      'printer.objects.subscribe',
      { objects: Object.fromEntries(objects.map(name => [name, null])) }
    )
    this.printer.replace(response.status as Record<string, Record<string, unknown>>)
    void this.#startThermals()
  }

  #onNotify (method: string, params: unknown[] | undefined): void {
    switch (method) {
      case 'notify_klippy_ready':
      case 'notify_klippy_shutdown':
        this.#refreshKlippy().catch(() => this.#scheduleKlippyRefresh())
        break
      case 'notify_klippy_disconnected':
        this.#stopThermals()
        this.printer.clear()
        this.klippy = { state: 'disconnected', message: '' }
        this.#scheduleKlippyRefresh()
        break
      case 'notify_gcode_response': {
        const message = params?.[0]
        if (typeof message === 'string') this.console.push(message, 'response')
        break
      }
      case 'notify_webcams_changed': {
        const payload = params?.[0]
        if (payload && typeof payload === 'object' && 'webcams' in payload && Array.isArray(payload.webcams)) {
          this.#setWebcams(payload.webcams)
        }
        break
      }
      case 'notify_user_logged_out':
        void this.#afterLogout()
        break
    }
  }

  #resetLive (): void {
    this.#clearKlippyTimer()
    this.#stopThermals()
    this.thermals.clear()
    this.webcams = []
    this.#identified = false
    this.printer.clear()
    this.server = null
    this.user = null
    this.hostname = null
    this.klippy = { state: 'unknown', message: '' }
  }
}

export const session = new Session()
