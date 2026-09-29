// Saved printers, per browser (as Fluidd does). The active one is what the
// session connects to; switching reconnects to another Moonraker.

import { browserTokenStore, type TokenStore } from './moonraker/tokens'
import { normalizeMoonrakerUrl } from './config'

export interface PrinterEntry {
  id: string
  /** User-chosen; empty falls back to the host's name. */
  name: string
  url: string
}

const LIST_KEY = 'printer-ui:printers'
const ACTIVE_KEY = 'printer-ui:active-printer'
/** The single saved address from before printers were a list. */
const LEGACY_URL_KEY = 'printer-ui:moonraker-url'

const isEntry = (value: unknown): value is PrinterEntry => (
  value != null && typeof value === 'object' &&
  'id' in value && typeof value.id === 'string' &&
  'name' in value && typeof value.name === 'string' &&
  'url' in value && typeof value.url === 'string'
)

export const parseStoredPrinters = (raw: string | null): PrinterEntry[] => {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

/** What to call a printer: its name, else the connected host's, else its address. */
export const printerLabel = (entry: PrinterEntry, hostname?: string | null): string => {
  if (entry.name.trim()) return entry.name.trim()
  if (hostname) return hostname
  try { return new URL(entry.url).host } catch { return entry.url }
}

const newId = () => Math.random().toString(36).slice(2, 10)

export class Printers {
  list = $state<PrinterEntry[]>([])
  activeId = $state<string | null>(null)
  active = $derived(this.list.find(entry => entry.id === this.activeId) ?? this.list[0] ?? null)

  constructor (private readonly store: TokenStore = browserTokenStore) {}

  /** Load the saved list, seeding it with `defaultUrl` (or a pre-list saved address) the first time. */
  init (defaultUrl: string): void {
    this.list = parseStoredPrinters(this.store.get(LIST_KEY))
    if (this.list.length === 0) {
      const legacy = this.store.get(LEGACY_URL_KEY)
      this.list = [{ id: newId(), name: '', url: legacy || defaultUrl }]
      this.store.remove(LEGACY_URL_KEY)
    }
    const saved = this.store.get(ACTIVE_KEY)
    this.activeId = this.list.some(entry => entry.id === saved) ? saved : this.list[0]?.id ?? null
    this.#persist()
  }

  select (id: string): PrinterEntry | null {
    const entry = this.list.find(item => item.id === id)
    if (!entry) return null
    this.activeId = id
    this.#persist()
    return entry
  }

  /** Returns the new entry, or null if the address isn't usable. */
  add (name: string, address: string, secure = false): PrinterEntry | null {
    const url = normalizeMoonrakerUrl(address, secure)
    if (!url) return null
    const entry = { id: newId(), name: name.trim(), url }
    this.list = [...this.list, entry]
    this.#persist()
    return entry
  }

  update (id: string, changes: { name?: string, address?: string }, secure = false): boolean {
    let url: string | undefined
    if (changes.address !== undefined) {
      const normalized = normalizeMoonrakerUrl(changes.address, secure)
      if (!normalized) return false
      url = normalized
    }
    this.list = this.list.map(entry => entry.id === id
      ? { ...entry, ...(changes.name !== undefined ? { name: changes.name.trim() } : {}), ...(url ? { url } : {}) }
      : entry)
    this.#persist()
    return true
  }

  /** The active printer, and the last one, can't be removed. */
  remove (id: string): boolean {
    if (id === this.active?.id || this.list.length <= 1) return false
    this.list = this.list.filter(entry => entry.id !== id)
    this.#persist()
    return true
  }

  #persist (): void {
    this.store.set(LIST_KEY, JSON.stringify(this.list))
    if (this.activeId) this.store.set(ACTIVE_KEY, this.activeId)
  }
}

export const printers = new Printers()
