// G-code builders. The param encoding and macro param parsing are ported
// from Fluidd (src/util/gcode-helpers.ts, src/util/gcode-macro-params.ts),
// GPL-3.0.

const QUOTABLE_CHARS = /[ '"#;=\\]/

/** Quotes an extended-command param value when Klipper would misparse it. */
export const encodeParamValue = (value: string): string => (
  QUOTABLE_CHARS.test(value)
    ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : value
)

/** `heater_generic chamber` → `chamber`; `extruder` stays `extruder`. */
export const objectName = (key: string): string => (
  key.includes(' ') ? key.slice(key.indexOf(' ') + 1) : key
)

export type TargetKind = 'heater' | 'temperature_fan'

export const targetKind = (key: string): TargetKind | null => {
  if (key.startsWith('temperature_fan ')) return 'temperature_fan'
  if (/^(extruder\d*|heater_bed|heater_generic .+)$/.test(key)) return 'heater'
  return null
}

export const setTargetCommand = (key: string, target: number): string | null => {
  const name = encodeParamValue(objectName(key))
  switch (targetKind(key)) {
    case 'heater': return `SET_HEATER_TEMPERATURE HEATER=${name} TARGET=${target}`
    case 'temperature_fan': return `SET_TEMPERATURE_FAN_TARGET TEMPERATURE_FAN=${name} TARGET=${target}`
    default: return null
  }
}

export type Axis = 'X' | 'Y' | 'Z'

/**
 * A relative (or absolute) move at `rate` mm/s. Uses Fluidd's
 * `_CLIENT_LINEAR_MOVE` macro when the printer config defines it, otherwise
 * brackets a plain G1 in SAVE/RESTORE_GCODE_STATE so the print's own
 * positioning mode is untouched.
 */
export const moveCommand = (
  movement: Partial<Record<Axis, number>>,
  rate: number,
  { absolute = false, clientMacro = false } = {}
): string => {
  const feed = Math.round(rate * 60)
  const axes = Object.entries(movement)

  if (clientMacro) {
    const params = axes.map(([axis, value]) => `${axis}=${value}`).join(' ')
    return `_CLIENT_LINEAR_MOVE ${params} F=${feed}${absolute ? ' ABSOLUTE=1' : ''}`
  }

  const params = axes.map(([axis, value]) => `${axis}${value}`).join(' ')
  return [
    'SAVE_GCODE_STATE NAME=_ui_movement',
    absolute ? 'G90' : 'G91',
    `G1 ${params} F${feed}`,
    'RESTORE_GCODE_STATE NAME=_ui_movement'
  ].join('\n')
}

export const zAdjustCommand = (delta: number, zHomed: boolean): string => (
  `SET_GCODE_OFFSET Z_ADJUST=${delta > 0 ? '+' : ''}${delta} MOVE=${zHomed ? 1 : 0}`
)

export interface MacroParam {
  name: string
  defaultValue: string
}

const PARAM = /params\.(\w+\b)(?!\s*\()(.*)/gi
const DEFAULT_VALUE = /\|\s*default\s*\(\s*((["'])(?:\\\2|(?!\2).)*\2|-?\d[^,)]*)/i

const paramDefault = (rest: string): string => {
  const match = DEFAULT_VALUE.exec(rest)
  if (!match) return ''
  const [, value = '', quote] = match
  if (quote) {
    return value.slice(1, -1)
      .replace(new RegExp(`\\\\${quote}`, 'g'), quote)
      .replace(/\\\\/g, '\\')
  }
  return value.trim()
}

/** Params a macro's template reads (`params.X | default(…)`), first use wins. */
export const macroParams = (template: string): MacroParam[] => {
  const seen = new Set<string>()
  const params: MacroParam[] = []
  for (const [, name = '', rest = ''] of template.matchAll(PARAM)) {
    const upper = name.toUpperCase()
    if (seen.has(upper)) continue
    seen.add(upper)
    params.push({ name: upper, defaultValue: paramDefault(rest) })
  }
  return params
}

/** Only params the user filled in are sent; the rest keep the macro's defaults. */
export const macroCommand = (name: string, values: Record<string, string> = {}): string => {
  const params = Object.entries(values)
    .filter(([, value]) => value.trim() !== '')
    .map(([key, value]) => `${key.toUpperCase()}=${encodeParamValue(value.trim())}`)
  return [name.toUpperCase(), ...params].join(' ')
}
