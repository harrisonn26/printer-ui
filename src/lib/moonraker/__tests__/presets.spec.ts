import { DEFAULT_PRESETS, Presets, presetScript } from '../presets.svelte'

describe('presetScript', () => {
  it('sets each named heater the printer has, skipping the rest', () => {
    const preset = { id: 'x', name: 'ABS', targets: { extruder: 250, heater_bed: 100, 'heater_generic chamber': 50 } }
    expect(presetScript(preset, ['extruder', 'heater_bed'])).toBe([
      'SET_HEATER_TEMPERATURE HEATER=extruder TARGET=250',
      'SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=100'
    ].join('\n'))
  })
})

describe('Presets.load', () => {
  it('falls back to the defaults when nothing is saved yet', async () => {
    const presets = new Presets()
    await presets.load(() => Promise.reject({ code: -32601, message: 'Key not found' }))
    expect(presets.list).toEqual(DEFAULT_PRESETS)
  })

  it('keeps only well-formed saved presets', async () => {
    const presets = new Presets()
    const saved = [{ id: 'a', name: 'PLA', targets: { extruder: 200 } }, { name: 'broken' }]
    await presets.load(<T>() => Promise.resolve({ value: saved } as T))
    expect(presets.list).toEqual([saved[0]])
  })

  it('shows nothing on other errors rather than defaults that would overwrite', async () => {
    const presets = new Presets()
    await presets.load(() => Promise.reject(new Error('Socket closed')))
    expect(presets.list).toEqual([])
  })
})
