// JSON-RPC over a single WebSocket. Knows nothing about sessions or auth:
// it opens, retries, correlates requests, and batches status notifications.

import type { SocketError } from './errors'

export type StatusUpdate = Record<string, Record<string, unknown>>

export interface SocketHandlers {
  onOpen: () => void
  /** The socket dropped; `retryIn` is the delay before the next attempt. */
  onClose: (retryIn: number) => void
  onNotify: (method: string, params: unknown[] | undefined) => void
  /** Batched `notify_status_update`, at most once per `STATUS_FLUSH_MS`. */
  onStatusUpdate: (update: StatusUpdate) => void
  /** Keys in `FAST_KEYS`, delivered unbatched. */
  onFastUpdate: (key: string, value: Record<string, unknown>) => void
}

const FAST_KEYS = ['motion_report']
const STATUS_FLUSH_MS = 1000
const BACKOFF_BASE = 1.4
const BACKOFF_MAX_MS = 10_000

interface Pending {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

export class SocketClosedError extends Error {
  constructor (message = 'Socket closed') {
    super(message)
    this.name = 'SocketClosedError'
  }
}

export class MoonrakerSocket {
  #url = ''
  #ws: WebSocket | null = null
  #pending = new Map<number, Pending>()
  #nextId = 1
  #attempt = 0
  #retryTimer: ReturnType<typeof setTimeout> | null = null
  #statusCache: StatusUpdate = {}
  #flushTimer: ReturnType<typeof setTimeout> | null = null
  #lastFlush = 0

  constructor (private readonly handlers: SocketHandlers) {}

  get attempt (): number {
    return this.#attempt
  }

  get isOpen (): boolean {
    return this.#ws?.readyState === WebSocket.OPEN
  }

  connect (url: string): void {
    this.close()
    this.#url = url
    this.#attempt = 0
    this.#open()
  }

  /** Skip the backoff wait, e.g. when the tab becomes visible again. */
  retryNow (): void {
    if (!this.#url || this.#ws) return
    this.#clearRetry()
    this.#open()
  }

  close (): void {
    this.#clearRetry()
    this.#url = ''
    this.#teardown(new SocketClosedError('Socket closed by client'))
  }

  call<T> (method: string, params?: Record<string, unknown>): Promise<T> {
    const ws = this.#ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new SocketClosedError('Socket is not open'))
    }

    const id = this.#nextId++
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }))
    })
  }

  #open (): void {
    const ws = new WebSocket(this.#url)
    this.#ws = ws

    ws.onopen = () => {
      this.#attempt = 0
      this.handlers.onOpen()
    }

    ws.onmessage = (event: MessageEvent<string>) => this.#onMessage(event.data)

    ws.onclose = () => {
      // A socket we already replaced or closed on purpose.
      if (this.#ws !== ws) return
      this.#teardown(new SocketClosedError())
      if (!this.#url) return

      this.#attempt += 1
      const retryIn = Math.min(BACKOFF_BASE ** this.#attempt * 1000, BACKOFF_MAX_MS)
      this.handlers.onClose(retryIn)
      this.#retryTimer = setTimeout(() => {
        this.#retryTimer = null
        this.#open()
      }, retryIn)
    }
  }

  #onMessage (data: string): void {
    let message: {
      id?: number
      result?: unknown
      error?: SocketError
      method?: string
      params?: unknown[]
    }
    try {
      message = JSON.parse(data)
    } catch {
      return
    }

    if (typeof message.id === 'number') {
      const pending = this.#pending.get(message.id)
      if (!pending) return
      this.#pending.delete(message.id)
      if (message.error) pending.reject(message.error)
      else pending.resolve(message.result)
      return
    }

    if (!message.method) return

    if (message.method === 'notify_status_update') {
      const update = message.params?.[0] as StatusUpdate | undefined
      if (update) this.#queueStatus(update)
      return
    }

    this.handlers.onNotify(message.method, message.params)
  }

  // Klipper sends changed fields per object, up to every 250ms per object.
  // Merge them field-wise and flush at most once a second, leading edge, so a
  // lone change (a fan toggle) shows up immediately rather than a second late.
  #queueStatus (update: StatusUpdate): void {
    for (const [key, fields] of Object.entries(update)) {
      if (FAST_KEYS.includes(key)) {
        this.handlers.onFastUpdate(key, fields)
        continue
      }
      this.#statusCache[key] = { ...this.#statusCache[key], ...fields }
    }

    if (this.#flushTimer || Object.keys(this.#statusCache).length === 0) return

    const wait = Math.max(0, this.#lastFlush + STATUS_FLUSH_MS - Date.now())
    if (wait === 0) {
      this.#flush()
    } else {
      this.#flushTimer = setTimeout(() => this.#flush(), wait)
    }
  }

  #flush (): void {
    this.#flushTimer = null
    this.#lastFlush = Date.now()
    const update = this.#statusCache
    this.#statusCache = {}
    if (Object.keys(update).length > 0) this.handlers.onStatusUpdate(update)
  }

  #teardown (reason: Error): void {
    if (this.#flushTimer) clearTimeout(this.#flushTimer)
    this.#flushTimer = null
    this.#statusCache = {}
    this.#lastFlush = 0

    for (const pending of this.#pending.values()) pending.reject(reason)
    this.#pending.clear()

    const ws = this.#ws
    this.#ws = null
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close()
    }
  }

  #clearRetry (): void {
    if (this.#retryTimer) clearTimeout(this.#retryTimer)
    this.#retryTimer = null
  }
}
