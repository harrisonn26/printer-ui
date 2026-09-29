import { formatDuration, jobTitle, objectLabel, prettyObjectName } from '../format'

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [59.6, '1m 00s'],
    [61, '1m 01s'],
    [3600, '1h 00m'],
    [3725, '1h 02m'],
    [null, '—'],
    [-1, '—'],
    [Number.NaN, '—']
  ])('%s → %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected)
  })
})

describe('prettyObjectName', () => {
  it.each([
    ['extruder', 'Extruder'],
    ['extruder1', 'Extruder 1'],
    ['heater_bed', 'Bed'],
    ['heater_generic chamber_heater', 'Chamber Heater'],
    ['temperature_sensor mcu', 'MCU'],
    ['temperature_sensor mcu_temp', 'MCU Temp'],
    ['temperature_sensor raspberry_pi', 'Raspberry Pi'],
    ['temperature_fan exhaust', 'Exhaust']
  ])('%s → %s', (input, expected) => {
    expect(prettyObjectName(input)).toBe(expected)
  })
})

describe('jobTitle', () => {
  it.each([
    ['Skadis universal mount slot_PLA_1h16m.gcode', 'Skadis universal mount slot'],
    ['sub/dir/Benchy_PETG_45m12s.gcode', 'Benchy'],
    ['Case_PLA+_2d3h.gcode', 'Case'],
    ['plain.gcode', 'plain'],
    ['my_part_v2.gcode', 'my_part_v2'],
    ['_PLA_1h.gcode', '_PLA_1h']
  ])('%s → %s', (input, expected) => {
    expect(jobTitle(input)).toBe(expected)
  })
})

describe('objectLabel', () => {
  it.each([
    ['MAIN-BODY.STL_ID_0_COPY_0', 'MAIN-BODY'],
    ['Cube.stl_ID_2_COPY_1', 'Cube #2'],
    ['bracket.3mf_ID_1_COPY_0', 'bracket'],
    ['plain_name', 'plain_name']
  ])('%s → %s', (input, expected) => {
    expect(objectLabel(input)).toBe(expected)
  })
})
