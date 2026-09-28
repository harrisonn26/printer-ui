import { SvelteMap } from 'svelte/reactivity'

type PrinterState = Klipper.PrinterState
type ObjectValue = Record<string, unknown>

/**
 * Klipper printer objects, one reactive entry per object. `get('extruder')`
 * only re-runs when the extruder changes, not on every status update. Values
 * are plain frozen-in-practice objects: each update replaces the object with
 * a merged copy instead of mutating it, so nothing is deep-proxied.
 */
export class PrinterObjects {
  #objects = new SvelteMap<string, ObjectValue>()

  get<K extends keyof PrinterState & string> (key: K): PrinterState[K] | undefined {
    return this.#objects.get(key) as PrinterState[K] | undefined
  }

  /** For object names only known at runtime, like `heater_generic chamber`. */
  raw (key: string): ObjectValue | undefined {
    return this.#objects.get(key)
  }

  has (key: string): boolean {
    return this.#objects.has(key)
  }

  keys (): string[] {
    return [...this.#objects.keys()]
  }

  /** Klipper diffs per field, so one level of merge is all an update needs. */
  apply (update: Record<string, ObjectValue>): void {
    for (const [key, fields] of Object.entries(update)) {
      this.#objects.set(key, { ...this.#objects.get(key), ...fields })
    }
  }

  replace (status: Record<string, ObjectValue>): void {
    this.#objects.clear()
    this.apply(status)
  }

  clear (): void {
    this.#objects.clear()
  }
}
