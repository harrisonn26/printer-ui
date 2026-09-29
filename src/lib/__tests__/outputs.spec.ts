import { fanCommand, hexToRgb, ledCommand, listOutputs, pinCommand, rgbToHex, type Output } from '../outputs'

const objects: Record<string, Record<string, unknown>> = {
  fan: { speed: 0.5, rpm: null },
  'heater_fan hotend_fan': { speed: 1, rpm: 4200 },
  'fan_generic exhaust fan': { speed: 0.4 },
  'output_pin beeper': { value: 0 },
  'output_pin _hidden': { value: 1 },
  'output_pin lights': { value: 0.5 },
  'neopixel status': { color_data: [[1, 0.5, 0, 0.2]] },
  extruder: { temperature: 200 }
}

const settings = {
  fan: { max_power: 1 },
  'fan_generic exhaust fan': { max_power: 0.8 },
  'output_pin beeper': { pwm: false },
  'output_pin lights': { pwm: true, scale: 10 },
  'neopixel status': { color_order: 'GRBW' }
}

const outputs = listOutputs(Object.keys(objects), key => objects[key], settings)
const byKey = (key: string) => outputs.find(output => output.key === key) as Output

describe('listOutputs', () => {
  it('lists fans first, hides _names and non-outputs', () => {
    expect(outputs.map(output => output.key)).toEqual([
      'fan',
      'fan_generic exhaust fan',
      'heater_fan hotend_fan',
      'output_pin beeper',
      'output_pin lights',
      'neopixel status'
    ])
  })

  it('reads fan speed relative to max_power', () => {
    expect(byKey('fan_generic exhaust fan').value).toBeCloseTo(0.5)
    expect(byKey('fan').label).toBe('Part fan')
  })

  it('marks Klipper-driven fans read-only', () => {
    expect(byKey('heater_fan hotend_fan').controllable).toBe(false)
    expect(byKey('heater_fan hotend_fan').rpm).toBe(4200)
    expect(byKey('fan').controllable).toBe(true)
  })

  it('reads LED colour and white channel support', () => {
    expect(byKey('neopixel status').color).toEqual({ r: 1, g: 0.5, b: 0, w: 0.2 })
    expect(byKey('neopixel status').hasWhite).toBe(true)
  })
})

describe('commands', () => {
  it('sets the part fan with M106/M107', () => {
    expect(fanCommand(byKey('fan'), 0.5)).toBe('M106 S128')
    expect(fanCommand(byKey('fan'), 0)).toBe('M107')
  })

  it('sets generic fans by name, quoting spaces', () => {
    expect(fanCommand(byKey('fan_generic exhaust fan'), 0.25)).toBe('SET_FAN_SPEED FAN="exhaust fan" SPEED=0.25')
  })

  it('refuses Klipper-driven fans', () => {
    expect(fanCommand(byKey('heater_fan hotend_fan'), 1)).toBeNull()
  })

  it('scales PWM pins and forces on/off otherwise', () => {
    expect(pinCommand(byKey('output_pin lights'), 0.5)).toBe('SET_PIN PIN=lights VALUE=5')
    expect(pinCommand(byKey('output_pin beeper'), 0.3)).toBe('SET_PIN PIN=beeper VALUE=1')
    expect(pinCommand(byKey('output_pin beeper'), 0)).toBe('SET_PIN PIN=beeper VALUE=0')
  })

  it('sets LEDs per channel', () => {
    expect(ledCommand(byKey('neopixel status'), { r: 1, g: 0, b: 0.5, w: 0 }))
      .toBe('SET_LED LED=status RED=1 GREEN=0 BLUE=0.5 WHITE=0')
  })
})

describe('colour conversion', () => {
  it('round-trips hex', () => {
    expect(rgbToHex({ r: 1, g: 0.5, b: 0, w: 0 })).toBe('#ff8000')
    expect(hexToRgb('#ff8000')).toEqual({ r: 1, g: 128 / 255, b: 0 })
  })
})
