import {
  encodeParamValue,
  excludeObjectCommand,
  extrudeCommand,
  flowFactorCommand,
  pressureAdvanceCommand,
  retractionCommand,
  speedFactorCommand,
  velocityLimitCommand,
  zOffsetApplyCommand,
  commandSuggestions,
  macroCommand,
  macroParams,
  moveCommand,
  setTargetCommand,
  zAdjustCommand
} from '../gcode'

describe('encodeParamValue', () => {
  it.each([
    ['PLA', 'PLA'],
    ['two words', '"two words"'],
    ['a"b', '"a\\"b"'],
    ['x=1', '"x=1"']
  ])('%s → %s', (input, expected) => {
    expect(encodeParamValue(input)).toBe(expected)
  })
})

describe('setTargetCommand', () => {
  it.each([
    ['extruder', 220, 'SET_HEATER_TEMPERATURE HEATER=extruder TARGET=220'],
    ['heater_bed', 0, 'SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=0'],
    ['heater_generic chamber', 45, 'SET_HEATER_TEMPERATURE HEATER=chamber TARGET=45'],
    ['temperature_fan exhaust', 40, 'SET_TEMPERATURE_FAN_TARGET TEMPERATURE_FAN=exhaust TARGET=40'],
    ['temperature_sensor mcu_temp', 40, null]
  ])('%s', (key, target, expected) => {
    expect(setTargetCommand(key, target)).toBe(expected)
  })
})

describe('moveCommand', () => {
  it('uses _CLIENT_LINEAR_MOVE when the printer defines it', () => {
    expect(moveCommand({ X: -10 }, 130, { clientMacro: true })).toBe('_CLIENT_LINEAR_MOVE X=-10 F=7800')
  })

  it('wraps a relative G1 in saved gcode state otherwise', () => {
    expect(moveCommand({ Z: 0.1 }, 10)).toBe([
      'SAVE_GCODE_STATE NAME=_ui_movement',
      'G91',
      'G1 Z0.1 F600',
      'RESTORE_GCODE_STATE NAME=_ui_movement'
    ].join('\n'))
  })
})

describe('zAdjustCommand', () => {
  it('signs the delta and only moves when Z is homed', () => {
    expect(zAdjustCommand(0.025, true)).toBe('SET_GCODE_OFFSET Z_ADJUST=+0.025 MOVE=1')
    expect(zAdjustCommand(-0.01, false)).toBe('SET_GCODE_OFFSET Z_ADJUST=-0.01 MOVE=0')
  })
})

describe('macroParams', () => {
  it('finds params with defaults, once each, in first-use order', () => {
    const template = [
      '{% set temp = params.TEMP|default(220)|float %}',
      '{% set mat = params.material | default("PLA") %}',
      'M104 S{params.TEMP}',
      '{% if params.LENGTH is defined %}G1 E{params.LENGTH}{% endif %}'
    ].join('\n')

    expect(macroParams(template)).toEqual([
      { name: 'TEMP', defaultValue: '220' },
      { name: 'MATERIAL', defaultValue: 'PLA' },
      { name: 'LENGTH', defaultValue: '' }
    ])
  })

  it('ignores method calls on params', () => {
    expect(macroParams('{% for p in params.items() %}{% endfor %}')).toEqual([])
  })
})

describe('macroCommand', () => {
  it('sends only filled params, quoting where needed', () => {
    expect(macroCommand('load_filament', { TEMP: '230', LENGTH: ' ', NAME: 'my spool' }))
      .toBe('LOAD_FILAMENT TEMP=230 NAME="my spool"')
  })
})

describe('extrudeCommand', () => {
  it('uses _CLIENT_LINEAR_MOVE when available', () => {
    expect(extrudeCommand(10, 5, { clientMacro: true })).toBe('_CLIENT_LINEAR_MOVE E=10 F=300')
    expect(extrudeCommand(-2, 5, { clientMacro: true })).toBe('_CLIENT_LINEAR_MOVE E=-2 F=300')
  })

  it('wraps a relative-E G1 otherwise', () => {
    expect(extrudeCommand(10, 5)).toBe([
      'SAVE_GCODE_STATE NAME=_ui_extrude',
      'M83',
      'G1 E10 F300',
      'RESTORE_GCODE_STATE NAME=_ui_extrude'
    ].join('\n'))
  })
})

describe('speed and flow', () => {
  it('rounds to whole percentages', () => {
    expect(speedFactorCommand(110.4)).toBe('M220 S110')
    expect(flowFactorCommand(95)).toBe('M221 S95')
  })
})

describe('tuning commands', () => {
  it('only sends the values given', () => {
    expect(pressureAdvanceCommand('extruder', { advance: 0.045 })).toBe('SET_PRESSURE_ADVANCE EXTRUDER=extruder ADVANCE=0.045')
    expect(velocityLimitCommand({ accel: 3000, squareCornerVelocity: 5 })).toBe('SET_VELOCITY_LIMIT ACCEL=3000 SQUARE_CORNER_VELOCITY=5')
    expect(retractionCommand({ retractLength: 0.8, unretractSpeed: 30 })).toBe('SET_RETRACTION RETRACT_LENGTH=0.8 UNRETRACT_SPEED=30')
  })

  it('drops non-finite values', () => {
    expect(velocityLimitCommand({ velocity: Number.NaN, accel: 2000 })).toBe('SET_VELOCITY_LIMIT ACCEL=2000')
  })
})

describe('object and offset commands', () => {
  it('quotes object names when needed', () => {
    expect(excludeObjectCommand('MAIN-BODY.STL_ID_0_COPY_0')).toBe('EXCLUDE_OBJECT NAME=MAIN-BODY.STL_ID_0_COPY_0')
    expect(excludeObjectCommand('part two')).toBe('EXCLUDE_OBJECT NAME="part two"')
  })

  it('applies the offset to the probe or the endstop', () => {
    expect(zOffsetApplyCommand(true)).toBe('Z_OFFSET_APPLY_PROBE')
    expect(zOffsetApplyCommand(false)).toBe('Z_OFFSET_APPLY_ENDSTOP')
  })
})

describe('commandSuggestions', () => {
  const help = {
    G28: 'Home',
    BED_MESH_CALIBRATE: 'Probe the bed',
    BED_MESH_CLEAR: 'Clear the mesh',
    BED_MESH_PROFILE: 'Profiles',
    _CLIENT_LINEAR_MOVE: 'Hidden helper',
    M104: 'Set extruder temperature'
  }

  it('matches the typed prefix, shortest first', () => {
    expect(commandSuggestions(help, 'bed_mesh_c').map(s => s.command)).toEqual(['BED_MESH_CLEAR', 'BED_MESH_CALIBRATE'])
  })

  it('stops suggesting once parameters start or the command is complete', () => {
    expect(commandSuggestions(help, 'G28 X')).toEqual([])
    expect(commandSuggestions(help, 'g28')).toEqual([])
  })

  it('hides underscore commands unless asked', () => {
    expect(commandSuggestions(help, '_').map(s => s.command)).toEqual(['_CLIENT_LINEAR_MOVE'])
    expect(commandSuggestions(help, 'C')).toEqual([])
  })

  it('returns nothing for empty input', () => {
    expect(commandSuggestions(help, '  ')).toEqual([])
  })
})
