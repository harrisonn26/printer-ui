// Temperature presets, kept in Moonraker's database so every browser (and
// Orca's device tab) sees the same list.

import { isNotFoundError } from './errors'
import { setTargetCommand } from '../gcode'

export interface Preset {
  id: string
  name: string
  /** Target °C by heater object name (`extruder`, `heater_bed`, …). 0 = off. */
  targets: Record<string, number>
}

type Call = <T>(method: string, params?: Record<string, unknown>) => Promise<T>

const NAMESPACE = 'printer-ui'
const KEY = 'temperature_presets'

/** Shown until the user saves their own list. */
export const DEFAULT_PRESETS: Preset[] = [
  { id: 'pla', name: 'PLA', targets: { extruder: 210, heater_bed: 60 } },
  { id: 'petg', name: 'PETG', targets: { extruder: 240, heater_bed: 80 } }
]

const isPreset = (value: unknown): value is Preset => (
  value != null &&
  typeof value === 'object' &&
  'id' in value && typeof value.id === 'string' &&
  'name' in value && typeof value.name === 'string' &&
  'targets' in value && value.targets != null && typeof value.targets === 'object'
)

export class Presets {
  list = $state<Preset[]>([])

  async load (call: Call): Promise<void> {
    try {
      const response = await call<{ value: unknown }>('server.database.get_item', { namespace: NAMESPACE, key: KEY })
      this.list = Array.isArray(response.value) ? response.value.filter(isPreset) : DEFAULT_PRESETS
    } catch (error) {
      this.list = isNotFoundError(error) ? DEFAULT_PRESETS : []
    }
  }

  async save (call: Call, list: Preset[]): Promise<void> {
    await call('server.database.post_item', { namespace: NAMESPACE, key: KEY, value: list })
    this.list = list
  }
}

/** One script setting every heater the preset names that this printer has. */
export const presetScript = (preset: Preset, heaters: string[]): string => (
  Object.entries(preset.targets)
    .filter(([key]) => heaters.includes(key))
    .map(([key, target]) => setTargetCommand(key, target))
    .filter((command): command is string => command != null)
    .join('\n')
)

export const newPresetId = (): string => Math.random().toString(36).slice(2, 10)
