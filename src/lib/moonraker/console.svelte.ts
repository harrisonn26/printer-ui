export type ConsoleKind = 'command' | 'response' | 'error'

export interface ConsoleEntry {
  id: number
  time: number
  kind: ConsoleKind
  message: string
}

const MAX_ENTRIES = 1000

const kindOf = (message: string, type: 'command' | 'response'): ConsoleKind => (
  type === 'response' && message.startsWith('!!') ? 'error' : type
)

/** The G-code console: commands we send and Klipper's responses. */
export class ConsoleLog {
  entries = $state<ConsoleEntry[]>([])
  #nextId = 1

  push (message: string, type: 'command' | 'response', time = Date.now()): void {
    this.entries.push({ id: this.#nextId++, time, kind: kindOf(message, type), message })
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES)
  }

  /** Replace with Moonraker's server-side history (server.gcode_store). */
  load (store: Moonraker.DataStore.GcodeStoreEntry[]): void {
    this.entries = store.slice(-MAX_ENTRIES).map(entry => ({
      id: this.#nextId++,
      time: entry.time ? entry.time * 1000 : Date.now(),
      kind: kindOf(entry.message, entry.type),
      message: entry.message
    }))
  }

  clear (): void {
    this.entries = []
  }
}
