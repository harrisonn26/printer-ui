export type ConsoleKind = 'command' | 'response' | 'error'

export interface ConsoleEntry {
  id: number
  time: number
  kind: ConsoleKind
  message: string
}

const MAX_ENTRIES = 1000
const MAX_HISTORY = 200

/**
 * Add `command` to a recall history, skipping consecutive repeats. Multi-line
 * scripts only when `multiline` — ones typed or pasted into the console, not
 * the scripts buttons send.
 */
export const appendHistory = (history: string[], command: string, { multiline = false, limit = MAX_HISTORY } = {}): string[] => {
  const line = command.trim()
  if (!line || (!multiline && line.includes('\n')) || history.at(-1) === line) return history
  return [...history, line].slice(-limit)
}

/** Tidy a typed or pasted script: one command per line, no blank lines or trailing spaces. */
export const normalizeScript = (text: string): string => text
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map(line => line.trimEnd())
  .filter(line => line.trim() !== '')
  .join('\n')

const kindOf = (message: string, type: 'command' | 'response'): ConsoleKind => (
  type === 'response' && message.startsWith('!!') ? 'error' : type
)

/** The G-code console: commands we send and Klipper's responses. */
export class ConsoleLog {
  entries = $state<ConsoleEntry[]>([])
  /** Commands to recall with ↑/↓, oldest first. Survives clear(). */
  history = $state.raw<string[]>([])
  #nextId = 1

  push (message: string, type: 'command' | 'response', { time = Date.now(), recall = false } = {}): void {
    if (type === 'command') this.history = appendHistory(this.history, message, { multiline: recall })
    this.entries.push({ id: this.#nextId++, time, kind: kindOf(message, type), message })
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES)
  }

  /** Replace with Moonraker's server-side history (server.gcode_store). */
  load (store: Moonraker.DataStore.GcodeStoreEntry[]): void {
    this.history = store
      .filter(entry => entry.type === 'command')
      .reduce((history, entry) => appendHistory(history, entry.message, { multiline: true }), [] as string[])
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
