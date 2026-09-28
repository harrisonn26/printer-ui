import { formatDuration, prettyObjectName } from '../format'

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
    ['temperature_sensor mcu', 'Mcu'],
    ['temperature_fan exhaust', 'Exhaust']
  ])('%s → %s', (input, expected) => {
    expect(prettyObjectName(input)).toBe(expected)
  })
})
