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

/** Extrude (positive) or retract (negative) `amount` mm at `rate` mm/s, in relative E mode. */
export const extrudeCommand = (amount: number, rate: number, { clientMacro = false } = {}): string => {
  const feed = Math.round(rate * 60)
  if (clientMacro) return `_CLIENT_LINEAR_MOVE E=${amount} F=${feed}`
  return [
    'SAVE_GCODE_STATE NAME=_ui_extrude',
    'M83',
    `G1 E${amount} F${feed}`,
    'RESTORE_GCODE_STATE NAME=_ui_extrude'
  ].join('\n')
}

/** M220/M221 take a whole percentage. */
export const speedFactorCommand = (percent: number): string => `M220 S${Math.round(percent)}`
export const flowFactorCommand = (percent: number): string => `M221 S${Math.round(percent)}`

const setParams = (command: string, params: Record<string, number | undefined>): string => {
  const parts = Object.entries(params)
    .filter((entry): entry is [string, number] => entry[1] !== undefined && Number.isFinite(entry[1]))
    .map(([key, value]) => `${key}=${value}`)
  return [command, ...parts].join(' ')
}

export const pressureAdvanceCommand = (
  extruder: string,
  values: { advance?: number, smoothTime?: number }
): string => setParams(`SET_PRESSURE_ADVANCE EXTRUDER=${encodeParamValue(extruder)}`, {
  ADVANCE: values.advance,
  SMOOTH_TIME: values.smoothTime
})

export const velocityLimitCommand = (values: {
  velocity?: number
  accel?: number
  squareCornerVelocity?: number
  minimumCruiseRatio?: number
}): string => setParams('SET_VELOCITY_LIMIT', {
  VELOCITY: values.velocity,
  ACCEL: values.accel,
  SQUARE_CORNER_VELOCITY: values.squareCornerVelocity,
  MINIMUM_CRUISE_RATIO: values.minimumCruiseRatio
})

export const retractionCommand = (values: {
  retractLength?: number
  retractSpeed?: number
  unretractExtraLength?: number
  unretractSpeed?: number
}): string => setParams('SET_RETRACTION', {
  RETRACT_LENGTH: values.retractLength,
  RETRACT_SPEED: values.retractSpeed,
  UNRETRACT_EXTRA_LENGTH: values.unretractExtraLength,
  UNRETRACT_SPEED: values.unretractSpeed
})

export const excludeObjectCommand = (name: string): string => `EXCLUDE_OBJECT NAME=${encodeParamValue(name)}`

/**
 * Write the live Z offset into the config. Printers homing Z with a probe
 * store it as the probe's z_offset; endstop printers adjust position_endstop.
 */
export const zOffsetApplyCommand = (probeHomed: boolean): string => (
  probeHomed ? 'Z_OFFSET_APPLY_PROBE' : 'Z_OFFSET_APPLY_ENDSTOP'
)

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

export interface CommandSuggestion {
  command: string
  description: string
}

/**
 * Commands from `printer.gcode.help` matching what's typed so far. Only the
 * first word is completed; hidden `_` commands only show once asked for.
 */
export const commandSuggestions = (
  help: Record<string, string>,
  input: string,
  limit = 6
): CommandSuggestion[] => {
  const typed = input.trimStart()
  if (!typed || /\s/.test(typed)) return []
  const prefix = typed.toUpperCase()
  return Object.entries(help)
    .filter(([command]) => command.toUpperCase().startsWith(prefix))
    .filter(([command]) => !command.startsWith('_') || prefix.startsWith('_'))
    .filter(([command]) => command.toUpperCase() !== prefix)
    .sort(([a], [b]) => a.length - b.length || a.localeCompare(b))
    .slice(0, limit)
    .map(([command, description]) => ({ command: command.toUpperCase(), description }))
}
