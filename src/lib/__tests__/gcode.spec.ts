import {
  encodeParamValue,
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
