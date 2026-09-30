import { STALE_MS, batteryLabel, parseHostBattery } from '../battery'

const now = 1_790_739_109_604
const reading = (overrides: Record<string, unknown> = {}) => ({
  capacity: 64, status: 'Charging', ac: true, time: now / 1000, ...overrides
})

describe('parseHostBattery', () => {
  it('reads a fresh charging reading', () => {
    expect(parseHostBattery(reading(), now)).toEqual({
      capacity: 64, status: 'Charging', ac: true, time: now, stale: false, onBattery: false
    })
  })

  it('flags running on battery, by lost mains or a discharging status', () => {
    expect(parseHostBattery(reading({ ac: false, status: 'Discharging' }), now)?.onBattery).toBe(true)
    expect(parseHostBattery(reading({ ac: false }), now)?.onBattery).toBe(true)
  })

  it('marks old readings stale', () => {
    expect(parseHostBattery(reading({ time: (now - STALE_MS - 1000) / 1000 }), now)?.stale).toBe(true)
  })

  it('rejects nonsense', () => {
    expect(parseHostBattery(null, now)).toBeNull()
    expect(parseHostBattery({ capacity: 5 }, now)).toBeNull()
  })
})

describe('batteryLabel', () => {
  it.each([
    [{ status: 'Charging' }, 'Charging'],
    [{ status: 'Full' }, 'Full'],
    [{ status: 'Not charging' }, 'Plugged in'],
    [{ status: 'Discharging', ac: false }, 'On battery']
  ])('%o → %s', (overrides, expected) => {
    expect(batteryLabel(parseHostBattery(reading(overrides), now)!)).toBe(expected)
  })
})
