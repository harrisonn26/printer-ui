// Temperature history for the chart: a 1Hz timeline seeded from Moonraker's
// server.temperature_store and extended by sampling live values each second.
//
// The arrays are plain (not reactive) — they're rebuilt into chart data on
// each `revision` bump, which is the only change signal.

export const RETENTION_MS = 20 * 60 * 1000

export type Reading = { temperature?: number, target?: number }

export const targetColumn = (key: string): string => `${key}#target`

type Column = (number | null)[]

export class ThermalHistory {
  time: number[] = []
  columns = new Map<string, Column>()
  revision = $state(0)

  clear (): void {
    this.time = []
    this.columns = new Map()
    this.revision++
  }

  /**
   * Replace the history with Moonraker's store. Its arrays are 1Hz samples
   * ending now; shorter ones (a sensor added later) are padded at the start.
   */
  load (store: Moonraker.DataStore.TemperatureStoreResponse, now = Date.now()): void {
    const entries = Object.entries(store)
    const length = Math.max(0, ...entries.map(([, entry]) => entry.temperatures.length))

    this.time = Array.from({ length }, (_, i) => now - (length - 1 - i) * 1000)
    this.columns = new Map()

    const padded = (values: number[]): Column => [
      ...Array<null>(length - values.length).fill(null),
      ...values
    ]

    for (const [key, entry] of entries) {
      this.columns.set(key, padded(entry.temperatures))
      if (entry.targets) this.columns.set(targetColumn(key), padded(entry.targets))
    }

    this.#trim(now)
    this.revision++
  }

  sample (readings: Map<string, Reading>, now = Date.now()): void {
    const values = new Map<string, number | null>()
    for (const [key, reading] of readings) {
      values.set(key, reading.temperature ?? null)
      if (reading.target !== undefined) values.set(targetColumn(key), reading.target)
    }

    // New sensors join with a gap behind them.
    for (const key of values.keys()) {
      if (!this.columns.has(key)) this.columns.set(key, Array<null>(this.time.length).fill(null))
    }

    this.time.push(now)
    for (const [key, column] of this.columns) column.push(values.get(key) ?? null)

    this.#trim(now)
    this.revision++
  }

  #trim (now: number): void {
    let drop = 0
    while (drop < this.time.length && (this.time[drop] ?? 0) < now - RETENTION_MS) drop++
    if (drop === 0) return
    this.time.splice(0, drop)
    for (const column of this.columns.values()) column.splice(0, drop)
  }
}
