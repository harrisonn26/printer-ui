// Host-level state: machine info, live resource stats, services, updates and
// power devices. Loaded once the session is ready and kept current by
// Moonraker's notifications.

import { parseHostBattery, type HostBattery } from '../battery'

type Call = <T>(method: string, params?: Record<string, unknown>) => Promise<T>

const BATTERY_POLL_MS = 60_000

const UPDATE_LOG_LIMIT = 200

export class SystemState {
  info = $state.raw<Moonraker.Machine.SystemInfo | null>(null)
  stats = $state.raw<Moonraker.ProcStats.Response | null>(null)
  updates = $state.raw<Moonraker.UpdateManager.StatusResponse | null>(null)
  power = $state.raw<Moonraker.Power.Device[]>([])
  /** Output of the update in progress, newest last. */
  updateLog = $state<string[]>([])
  updating = $state<string | null>(null)
  /** From deploy/host-battery.py; null when the host has none or it isn't installed. */
  battery = $state.raw<HostBattery | null>(null)
  #batteryTimer: ReturnType<typeof setInterval> | null = null

  async load (call: Call): Promise<void> {
    const settle = async <T>(promise: Promise<T>, apply: (value: T) => void) => {
      try {
        apply(await promise)
      } catch {
        // Each part is optional: an older Moonraker, or a component that isn't configured.
      }
    }
    await Promise.all([
      settle(call<Moonraker.Machine.SystemInfoResponse>('machine.system_info'), r => { this.info = r.system_info }),
      settle(call<Moonraker.ProcStats.Response>('machine.proc_stats'), r => { this.stats = r }),
      settle(call<Moonraker.UpdateManager.StatusResponse>('machine.update.status'), r => { this.updates = r }),
      settle(call<Moonraker.Power.DevicesResponse>('machine.device_power.devices'), r => { this.power = r.devices }),
      this.#loadBattery(call)
    ])
    // Moonraker doesn't announce database writes, so the battery is polled.
    if (this.#batteryTimer) clearInterval(this.#batteryTimer)
    this.#batteryTimer = setInterval(() => { void this.#loadBattery(call) }, BATTERY_POLL_MS)
  }

  async #loadBattery (call: Call): Promise<void> {
    try {
      const response = await call<{ value: unknown }>('server.database.get_item', { namespace: 'printer-ui', key: 'host_battery' })
      this.battery = parseHostBattery(response.value)
    } catch {
      this.battery = null
    }
  }

  clear (): void {
    this.info = null
    this.stats = null
    this.updates = null
    this.power = []
    this.updateLog = []
    this.updating = null
    this.battery = null
    if (this.#batteryTimer) clearInterval(this.#batteryTimer)
    this.#batteryTimer = null
  }

  /** Returns true when the notification was ours. */
  handle (method: string, params: unknown[] | undefined, call: Call): boolean {
    const payload = params?.[0]
    const isObject = (value: unknown): value is Record<string, unknown> => value != null && typeof value === 'object'

    switch (method) {
      case 'notify_proc_stat_update':
        if (isObject(payload) && this.stats) {
          this.stats = { ...this.stats, ...payload }
        }
        return true

      case 'notify_service_state_changed':
        if (isObject(payload) && this.info) {
          this.info = {
            ...this.info,
            service_state: { ...this.info.service_state, ...(payload as Moonraker.Machine.ServiceState) }
          }
        }
        return true

      case 'notify_power_changed':
        if (isObject(payload) && typeof payload.device === 'string') {
          const changed = payload as unknown as Moonraker.Power.Device
          this.power = this.power.map(device => (device.device === changed.device ? { ...device, ...changed } : device))
        }
        return true

      case 'notify_update_refreshed':
        if (isObject(payload) && isObject(payload.version_info)) {
          this.updates = payload as unknown as Moonraker.UpdateManager.StatusResponse
        }
        return true

      case 'notify_update_response':
        if (isObject(payload) && typeof payload.message === 'string') {
          this.updateLog.push(payload.message)
          if (this.updateLog.length > UPDATE_LOG_LIMIT) this.updateLog.splice(0, this.updateLog.length - UPDATE_LOG_LIMIT)
          if (payload.complete === true) {
            this.updating = null
            call<Moonraker.UpdateManager.StatusResponse>('machine.update.status')
              .then(response => { this.updates = response })
              .catch(() => {})
          }
        }
        return true
    }
    return false
  }
}

/** The RPC that updates one component, by its update_manager entry. */
export const updateMethod = (
  name: string,
  entry: Moonraker.UpdateManager.VersionInfoEntry
): { method: string, params?: Record<string, unknown> } => {
  if (name === 'moonraker') return { method: 'machine.update.moonraker' }
  if (name === 'klipper') return { method: 'machine.update.klipper', params: { include_deps: true } }
  if (name === 'system' || entry.configured_type === 'system') return { method: 'machine.update.system' }
  return { method: 'machine.update.client', params: { name } }
}

export type UpdateState = 'current' | 'available' | 'problem'

/** Whether an entry is up to date, and a short description of why not. */
export const updateSummary = (
  entry: Moonraker.UpdateManager.VersionInfoEntry
): { state: UpdateState, detail: string } => {
  if ('package_count' in entry) {
    return entry.package_count > 0
      ? { state: 'available', detail: `${entry.package_count} package${entry.package_count === 1 ? '' : 's'}` }
      : { state: 'current', detail: 'Up to date' }
  }
  if (!entry.is_valid || ('corrupt' in entry && entry.corrupt)) {
    return { state: 'problem', detail: 'Invalid install' }
  }
  if ('is_dirty' in entry && entry.is_dirty) {
    return { state: 'problem', detail: 'Local changes' }
  }
  if ('commits_behind_count' in entry && entry.commits_behind_count > 0) {
    return { state: 'available', detail: `${entry.commits_behind_count} commit${entry.commits_behind_count === 1 ? '' : 's'} behind` }
  }
  if (entry.remote_version && entry.version !== entry.remote_version && entry.remote_version !== '?') {
    return { state: 'available', detail: 'Update available' }
  }
  return { state: 'current', detail: 'Up to date' }
}
