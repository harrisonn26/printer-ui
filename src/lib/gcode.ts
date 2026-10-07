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

/**
 * Bare G/M codes Klipper's `printer.gcode.help` doesn't describe: fallback
 * docs so typing "G" still suggests G0/G1/G28… with a description.
 * Merge under live help: `{ ...GCODE_FALLBACK, ...help }`.
 */
export const GCODE_FALLBACK: Record<string, string> = {
  G0: 'Rapid linear move.',
  G1: 'Linear move.',
  G28: 'Home axes (no args = home all).',
  G90: 'Absolute positioning.',
  G91: 'Relative positioning.',
  G92: 'Set current position.',
  M104: 'Set extruder temperature (no wait).',
  M109: 'Set extruder temperature and wait.',
  M140: 'Set bed temperature (no wait).',
  M190: 'Set bed temperature and wait.',
  M220: 'Set speed factor.',
  M221: 'Set flow factor.',
  M84: 'Disable steppers (no args = all).',
  M106: 'Set fan speed.',
  M107: 'Turn fan off.',
  G4: 'Dwell (pause). P in milliseconds, S in seconds.',
  BED_MESH_CALIBRATE: 'Perform mesh bed leveling.',
  BED_MESH_PROFILE: 'Bed mesh persistent storage management.',
  BED_MESH_OUTPUT: 'Retrieve interpolated grid of probed z-points.',
  BED_MESH_CLEAR: 'Clear the mesh so no z-adjustment is made.',
  BED_MESH_OFFSET: 'Add X/Y offsets to the mesh lookup.',
  PROBE: 'Probe Z-height at current XY position.',
  QUERY_PROBE: 'Return the status of the z-probe.',
  PROBE_CALIBRATE: "Calibrate the probe's z_offset.",
  PROBE_ACCURACY: 'Probe Z-height accuracy at current XY position.',
  Z_ENDSTOP_CALIBRATE: 'Calibrate the Z endstop position.',
  Z_TILT_ADJUST: 'Adjust for Z tilt.',
  QUAD_GANTRY_LEVEL: 'Level the gantry.',
  SCREWS_TILT_CALCULATE: 'Calculate bed screw adjustments.',
  BED_SCREWS_ADJUST: 'Guide bed screw adjustment.',
  STEPPER_BUZZ: 'Oscillate a given stepper to help identify it.',
  FORCE_MOVE: 'Manually move a stepper; invalidates kinematics.',
  SET_KINEMATIC_POSITION: 'Force a low-level kinematic position.',
  SET_STEPPER_ENABLE: 'Enable/disable individual stepper by name.',
  SET_TMC_FIELD: 'Set a register field of a TMC driver.',
  INIT_TMC: 'Initialize TMC stepper driver registers.',
  DUMP_TMC: 'Read and display TMC stepper driver registers.',
  SET_RETRACTION: 'Set firmware retraction parameters.',
  TUNING_TOWER: 'Tool to adjust a parameter at each Z height.',
  SET_PAUSE_NEXT_LAYER: 'Enable/disable pause at the next layer.',
  SET_PAUSE_AT_LAYER: 'Enable/disable pause at a given layer.',
  UPDATE_DELAYED_GCODE: 'Update the duration of a delayed_gcode.',
  RESPOND: 'Echo a message to the console.',
  SET_SERVO: 'Set servo angle or pulse width.',
  ACTIVATE_EXTRUDER: 'Change the active extruder.',
  SYNC_EXTRUDER_MOTION: 'Set extruder stepper motion queue.',
  SET_EXTRUDER_ROTATION_DISTANCE: 'Set extruder rotation distance.',
  SYNC_STEPPER_TO_EXTRUDER: 'Bind a stepper to an extruder.',
  QUERY_FILAMENT_SENSOR: 'Query the status of the filament sensor.',
  SET_FILAMENT_SENSOR: 'Set the filament sensor on/off.',
  GET_POSITION: 'Return the current location of the toolhead.',
  GET_CURRENT_SKEW: 'Report current printer skew.',
  CALC_MEASURED_SKEW: 'Calculate skew from measured print.',
  SKEW_PROFILE: 'Profile management for skew_correction.',
  M300: 'Play a beep. S in Hz, P in milliseconds.',
  M400: 'Wait for all moves to finish.',
  M82: 'Absolute extrusion mode.',
  M83: 'Relative extrusion mode.',
  TURN_OFF_HEATERS: 'Turn off all heaters.',
  SET_DISPLAY_GROUP: 'Set the active display group.',
  SDCARD_PRINT_FILE: 'Load an SD file and start the print.',
  SDCARD_RESET_FILE: 'Clear the loaded SD file.',
  CLEAR_PAUSE: 'Clear the paused state without resuming.',
  BLTOUCH_DEBUG: 'BLTouch debug commands.',
  SET_HEATER_TEMPERATURE: 'Sets a heater temperature.',
  PID_CALIBRATE: 'Run PID calibration test.',
  SET_PRESSURE_ADVANCE: 'Set pressure advance parameters.',
  SET_VELOCITY_LIMIT: 'Set printer velocity limits.',
  SET_GCODE_OFFSET: 'Set a virtual offset to g-code positions.',
  SET_SKEW: 'Set skew based on lengths of measured object.',
  SET_PIN: 'Set the value of an output pin.',
  QUERY_ADC: 'Report the last value of an analog pin.',
  SET_TMC_CURRENT: 'Set the current of a TMC driver.',
  TEMPERATURE_WAIT: 'Wait for a temperature on a sensor.',
  SET_IDLE_TIMEOUT: 'Set the idle timeout in seconds.',
  SAVE_GCODE_STATE: 'Save G-Code coordinate state.',
  RESTORE_GCODE_STATE: 'Restore a previously saved G-Code state.',
  SET_GCODE_VARIABLE: 'Set the value of a G-Code macro variable.',
  EXCLUDE_OBJECT: 'Cancel moves inside a specified object.',
  EXCLUDE_OBJECT_DEFINE: 'Provides a summary of an object.',
  SET_DISPLAY_TEXT: 'Set or clear the display message.',
  QUERY_ENDSTOPS: 'Report on the status of each endstop.'
}

/** Known args for bare G/M codes. Rendered as chips, not stuffed into the description. */
export const GCODE_PARAMS: Record<string, string[]> = {
  G0: ['X', 'Y', 'Z', 'E', 'F'],
  G1: ['X', 'Y', 'Z', 'E', 'F'],
  G28: ['X', 'Y', 'Z'],
  G92: ['X', 'Y', 'Z', 'E'],
  M104: ['S', 'T'],
  M109: ['S', 'T'],
  M140: ['S'],
  M190: ['S'],
  M220: ['S'],
  M221: ['S'],
  M84: ['X', 'Y', 'Z', 'E'],
  M106: ['S'],
  G4: ['P', 'S'],
  M300: ['S', 'P']
}

/**
 * Curated params for extended commands Klipper exposes no arg schema for.
 * Add entries here as needed — stage-2 completion reads this table.
 */
export const KNOWN_COMMAND_PARAMS: Record<string, ParamSuggestion[]> = {
  BLTOUCH_DEBUG: [
    { name: 'COMMAND', description: 'pin_up, pin_down, self_test, reset, touch_mode…' }
  ],
  SET_HEATER_TEMPERATURE: [
    { name: 'HEATER', description: 'Heater name (extruder, heater_bed, …)' },
    { name: 'TARGET', description: 'Target temperature (°C)' }
  ],
  PID_CALIBRATE: [
    { name: 'HEATER', description: 'Heater name (extruder, heater_bed)' },
    { name: 'TARGET', description: 'Target temperature (°C)' }
  ],
  SET_PRESSURE_ADVANCE: [
    { name: 'EXTRUDER', description: 'Extruder name' },
    { name: 'ADVANCE', description: 'Advance factor' },
    { name: 'SMOOTH_TIME', description: 'Smoothing time (s)' }
  ],
  SET_VELOCITY_LIMIT: [
    { name: 'VELOCITY', description: 'Max velocity (mm/s)' },
    { name: 'ACCEL', description: 'Max acceleration (mm/s²)' },
    { name: 'SQUARE_CORNER_VELOCITY', description: 'Square corner velocity (mm/s)' },
    { name: 'MINIMUM_CRUISE_RATIO', description: 'Minimum cruise ratio (0–1)' }
  ],
  SET_GCODE_OFFSET: [
    { name: 'X', description: 'X offset (mm)' },
    { name: 'Y', description: 'Y offset (mm)' },
    { name: 'Z', description: 'Z offset (mm)' },
    { name: 'MOVE', description: '1 to move the toolhead, 0 to stay' }
  ],
  SET_SKEW: [
    { name: 'XY', description: 'Measured XY skew' },
    { name: 'XZ', description: 'Measured XZ skew' },
    { name: 'YZ', description: 'Measured YZ skew' }
  ],
  SET_PIN: [
    { name: 'PIN', description: 'Pin name' },
    { name: 'VALUE', description: 'Value (0–1, or 0–255 for PWM)' }
  ],
  QUERY_ADC: [
    { name: 'NAME', description: 'ADC name' }
  ],
  SET_TMC_CURRENT: [
    { name: 'STEPPER', description: 'Stepper name' },
    { name: 'CURRENT', description: 'Run current (A)' },
    { name: 'HOLDCURRENT', description: 'Hold current (A)' }
  ],
  TEMPERATURE_WAIT: [
    { name: 'SENSOR', description: 'Sensor name' },
    { name: 'MINIMUM', description: 'Minimum temperature (°C)' },
    { name: 'MAXIMUM', description: 'Maximum temperature (°C)' }
  ],
  SET_IDLE_TIMEOUT: [
    { name: 'TIMEOUT', description: 'Idle timeout (s)' }
  ],
  SAVE_GCODE_STATE: [
    { name: 'NAME', description: 'State name to save under' }
  ],
  RESTORE_GCODE_STATE: [
    { name: 'NAME', description: 'State name to restore' },
    { name: 'MOVE', description: '1 to move, 0 to stay' }
  ],
  SET_GCODE_VARIABLE: [
    { name: 'MACRO', description: 'Macro name' },
    { name: 'VARIABLE', description: 'Variable name' },
    { name: 'VALUE', description: 'New value' }
  ],
  EXCLUDE_OBJECT: [
    { name: 'NAME', description: 'Object name to exclude' }
  ],
  EXCLUDE_OBJECT_DEFINE: [
    { name: 'NAME', description: 'Object name' }
  ],
  SET_DISPLAY_TEXT: [
    { name: 'MSG', description: 'Message (empty clears the display)' }
  ],
  BED_MESH_CALIBRATE: [
    { name: 'METHOD', description: 'scan, rapid_scan or automatic' },
    { name: 'PROFILE', description: 'Profile name to save to' }
  ],
  BED_MESH_PROFILE: [
    { name: 'LOAD', description: 'Profile name to load' },
    { name: 'SAVE', description: 'Profile name to save' },
    { name: 'REMOVE', description: 'Profile name to delete' }
  ],
  BED_MESH_OFFSET: [
    { name: 'X', description: 'X offset (mm)' },
    { name: 'Y', description: 'Y offset (mm)' }
  ],
  PROBE: [
    { name: 'SAMPLES', description: 'Number of samples' },
    { name: 'SAMPLE_RETRACT_DIST', description: 'Retract distance between samples (mm)' }
  ],
  PROBE_ACCURACY: [
    { name: 'SAMPLES', description: 'Number of samples' }
  ],
  STEPPER_BUZZ: [
    { name: 'STEPPER', description: 'Stepper name (e.g. stepper_x)' }
  ],
  FORCE_MOVE: [
    { name: 'STEPPER', description: 'Stepper name' },
    { name: 'DISTANCE', description: 'Move distance (mm)' },
    { name: 'VELOCITY', description: 'Velocity (mm/s)' },
    { name: 'ACCEL', description: 'Acceleration (mm/s²)' }
  ],
  SET_KINEMATIC_POSITION: [
    { name: 'X', description: 'X position (mm)' },
    { name: 'Y', description: 'Y position (mm)' },
    { name: 'Z', description: 'Z position (mm)' }
  ],
  SET_STEPPER_ENABLE: [
    { name: 'STEPPER', description: 'Stepper name' },
    { name: 'ENABLE', description: '1 to enable, 0 to disable' }
  ],
  SET_TMC_FIELD: [
    { name: 'STEPPER', description: 'Stepper name' },
    { name: 'FIELD', description: 'Register field name' },
    { name: 'VALUE', description: 'Value to set' }
  ],
  INIT_TMC: [
    { name: 'STEPPER', description: 'Stepper name (none = all)' }
  ],
  DUMP_TMC: [
    { name: 'STEPPER', description: 'Stepper name' }
  ],
  SET_RETRACTION: [
    { name: 'RETRACT_LENGTH', description: 'Retract length (mm)' },
    { name: 'RETRACT_SPEED', description: 'Retract speed (mm/s)' },
    { name: 'UNRETRACT_EXTRA_LENGTH', description: 'Extra length on unretract (mm)' },
    { name: 'UNRETRACT_SPEED', description: 'Unretract speed (mm/s)' }
  ],
  TUNING_TOWER: [
    { name: 'COMMAND', description: 'Command to adjust each layer' },
    { name: 'PARAMETER', description: 'Parameter name to adjust' },
    { name: 'START', description: 'Starting value' },
    { name: 'STEP_DELTA', description: 'Change per step' },
    { name: 'STEP_HEIGHT', description: 'Height per step (mm)' }
  ],
  SET_PAUSE_NEXT_LAYER: [
    { name: 'ENABLE', description: '1 to enable, 0 to disable' }
  ],
  SET_PAUSE_AT_LAYER: [
    { name: 'ENABLE', description: '1 to enable, 0 to disable' },
    { name: 'LAYER', description: 'Layer number' }
  ],
  UPDATE_DELAYED_GCODE: [
    { name: 'ID', description: 'Delayed-gcode ID' },
    { name: 'DURATION', description: 'Delay in seconds' }
  ],
  RESPOND: [
    { name: 'MSG', description: 'Message text' },
    { name: 'PREFIX', description: 'Message prefix' },
    { name: 'TYPE', description: 'echo, error or command' }
  ],
  SET_SERVO: [
    { name: 'SERVO', description: 'Servo name' },
    { name: 'ANGLE', description: 'Angle (degrees)' },
    { name: 'WIDTH', description: 'Pulse width (s)' }
  ],
  ACTIVATE_EXTRUDER: [
    { name: 'EXTRUDER', description: 'Extruder name' }
  ],
  SYNC_EXTRUDER_MOTION: [
    { name: 'EXTRUDER', description: 'Extruder stepper name' },
    { name: 'MOTION_QUEUE', description: 'Motion queue to sync to (empty to unsync)' }
  ],
  SET_EXTRUDER_ROTATION_DISTANCE: [
    { name: 'EXTRUDER', description: 'Extruder name' },
    { name: 'DISTANCE', description: 'Rotation distance (mm)' }
  ],
  SYNC_STEPPER_TO_EXTRUDER: [
    { name: 'STEPPER', description: 'Stepper name' },
    { name: 'EXTRUDER', description: 'Extruder name (empty to unsync)' }
  ],
  QUERY_FILAMENT_SENSOR: [
    { name: 'SENSOR', description: 'Sensor name' }
  ],
  SET_FILAMENT_SENSOR: [
    { name: 'SENSOR', description: 'Sensor name' },
    { name: 'ENABLE', description: '1 to enable, 0 to disable' }
  ],
  CALC_MEASURED_SKEW: [
    { name: 'AC', description: 'Measured AC length (mm)' },
    { name: 'BD', description: 'Measured BD length (mm)' },
    { name: 'AD', description: 'Measured AD length (mm)' }
  ],
  SKEW_PROFILE: [
    { name: 'LOAD', description: 'Profile name to load' },
    { name: 'SAVE', description: 'Profile name to save' },
    { name: 'REMOVE', description: 'Profile name to delete' }
  ],
  SET_DISPLAY_GROUP: [
    { name: 'GROUP', description: 'Display group (empty clears)' }
  ],
  SDCARD_PRINT_FILE: [
    { name: 'FILENAME', description: 'File path on the SD card' }
  ]
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

/**
 * Params a command takes, after its name is complete and a space follows.
 * `after` is everything past the command's trailing space; already-used
 * `NAME=` params are excluded so each suggests once.
 */
export interface ParamSuggestion {
  name: string
  description: string
  defaultValue?: string
}

/** Generic one-liners for single-letter args. Macro-specific defaults attach where known. */
export const ARG_DESCRIPTIONS: Record<string, string> = {
  X: 'X position (mm)',
  Y: 'Y position (mm)',
  Z: 'Z position (mm)',
  E: 'Extrude length (mm)',
  F: 'Feedrate (mm/min)',
  S: 'Target value',
  T: 'Tool index',
  P: 'Parameter value or time (ms)'
}

export const paramSuggestions = (
  known: ParamSuggestion[],
  after: string,
  limit = 6
): ParamSuggestion[] => {
  if (known.length === 0) return []
  const used = new Set(
    [...after.matchAll(/(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)=/g)].map(match => (match[1] ?? '').toUpperCase())
  )
  const token = (after.split(/\s+/).pop() ?? '').toUpperCase()
  return known
    .filter(param => !used.has(param.name.toUpperCase()))
    .filter(param => !token || param.name.toUpperCase().startsWith(token))
    .slice(0, limit)
}

/** Fluidd/Mainsail client macros: pause when the slicer reports reaching `layer`. */
export const pauseAtLayerCommand = (layer: number | null): string => (
  layer == null ? 'SET_PAUSE_AT_LAYER ENABLE=0' : `SET_PAUSE_AT_LAYER ENABLE=1 LAYER=${Math.round(layer)}`
)

export const pauseNextLayerCommand = (enable: boolean): string => `SET_PAUSE_NEXT_LAYER ENABLE=${enable ? 1 : 0}`

/** The line Orca needs in its layer-change G-code for layer pauses (and layer counts) to work. */
export const ORCA_LAYER_CHANGE_GCODE = 'SET_PRINT_STATS_INFO CURRENT_LAYER={layer_num + 1}'

/** Axes a command needs homed before Klipper will run it. */
export const isHomed = (homedAxes: string | undefined, axes = 'xyz'): boolean => (
  [...axes].every(axis => (homedAxes ?? '').toLowerCase().includes(axis))
)

/** Prefix `G28` when the printer isn't fully homed, so calibrations don't fail on "Must home axis first". */
export const homeFirst = (script: string, homedAxes: string | undefined): string => (
  isHomed(homedAxes) ? script : `G28\n${script}`
)

export interface ProbeCalibrationTarget {
  /** Where the probe should touch: the middle of the probeable area. */
  probe: [number, number]
  /** Where that puts the toolhead (nozzle), clamped to the axis limits. */
  toolhead: [number, number]
}

/**
 * PROBE_CALIBRATE probes at the current XY and then moves the nozzle over
 * that point, so start with the probe over the middle of the bed. The middle
 * is the centre of the `[bed_mesh]` area (probe coordinates) when there is
 * one, else of the axis travel.
 */
export const probeCalibrationTarget = (input: {
  meshMin?: [number, number]
  meshMax?: [number, number]
  axisMin: [number, number]
  axisMax: [number, number]
  probeOffset: [number, number]
}): ProbeCalibrationTarget => {
  const low = input.meshMin ?? input.axisMin
  const high = input.meshMax ?? input.axisMax
  const probe: [number, number] = [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2]
  const clamp = (value: number, axis: 0 | 1) => Math.min(Math.max(value, input.axisMin[axis]), input.axisMax[axis])
  const round = (value: number) => Math.round(value * 100) / 100
  return {
    probe: [round(probe[0]), round(probe[1])],
    toolhead: [round(clamp(probe[0] - input.probeOffset[0], 0)), round(clamp(probe[1] - input.probeOffset[1], 1))]
  }
}

/** Home if needed, lift, move to `toolhead`, then start the calibration. */
export const probeCalibrateScript = (
  command: 'PROBE_CALIBRATE' | 'Z_ENDSTOP_CALIBRATE',
  toolhead: [number, number],
  homedAxes: string | undefined,
  { liftZ = 10, xySpeed = 130, zSpeed = 10 } = {}
): string => homeFirst([
  'SAVE_GCODE_STATE NAME=_ui_probe_calibrate',
  'G90',
  `G1 Z${liftZ} F${zSpeed * 60}`,
  `G1 X${toolhead[0]} Y${toolhead[1]} F${xySpeed * 60}`,
  'RESTORE_GCODE_STATE NAME=_ui_probe_calibrate',
  command
].join('\n'), homedAxes)
