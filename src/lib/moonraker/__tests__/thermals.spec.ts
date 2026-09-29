import { RETENTION_MS, ThermalHistory, targetColumn } from '../thermals.svelte'

describe('ThermalHistory', () => {
  it('right-aligns the store on a 1Hz timeline, padding shorter sensors', () => {
    const history = new ThermalHistory()
    history.load({
      extruder: { temperatures: [20, 21, 22], targets: [0, 200, 200] },
      'temperature_sensor mcu': { temperatures: [40] }
    }, 10_000)

    expect(history.time).toEqual([8_000, 9_000, 10_000])
    expect(history.columns.get('extruder')).toEqual([20, 21, 22])
    expect(history.columns.get(targetColumn('extruder'))).toEqual([0, 200, 200])
    expect(history.columns.get('temperature_sensor mcu')).toEqual([null, null, 40])
  })

  it('appends samples, adding new sensors with a gap behind them', () => {
    const history = new ThermalHistory()
    history.load({ extruder: { temperatures: [20] } }, 1_000)
    history.sample(new Map([
      ['extruder', { temperature: 21, target: 200 }],
      ['heater_bed', { temperature: 30, target: 0 }]
    ]), 2_000)

    expect(history.time).toEqual([1_000, 2_000])
    expect(history.columns.get('extruder')).toEqual([20, 21])
    expect(history.columns.get(targetColumn('extruder'))).toEqual([null, 200])
    expect(history.columns.get('heater_bed')).toEqual([null, 30])
  })

  it('records a missing reading as a gap, not a stale value', () => {
    const history = new ThermalHistory()
    history.sample(new Map([['extruder', { temperature: 21 }]]), 1_000)
    history.sample(new Map(), 2_000)

    expect(history.columns.get('extruder')).toEqual([21, null])
  })

  it('drops samples older than the retention window', () => {
    const history = new ThermalHistory()
    history.sample(new Map([['extruder', { temperature: 1 }]]), 0)
    history.sample(new Map([['extruder', { temperature: 2 }]]), 1_000)
    history.sample(new Map([['extruder', { temperature: 3 }]]), RETENTION_MS + 500)

    expect(history.time).toEqual([1_000, RETENTION_MS + 500])
    expect(history.columns.get('extruder')).toEqual([2, 3])
  })

  it('bumps the revision on every change', () => {
    const history = new ThermalHistory()
    const before = history.revision
    history.sample(new Map(), 0)
    history.clear()
    expect(history.revision).toBe(before + 2)
  })
})
