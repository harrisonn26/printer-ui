// Fans, output pins and LEDs. Commands follow Fluidd's output widgets
// (src/components/widgets/outputs), GPL-3.0.

import { encodeParamValue } from './gcode'
import { prettyObjectName } from './format'

export type OutputKind = 'fan' | 'fan_generic' | 'heater_fan' | 'controller_fan' | 'temperature_fan' | 'output_pin' | 'led'

const LED_TYPES = new Set(['led', 'neopixel', 'dotstar', 'pca9533', 'pca9632'])
const FAN_TYPES = new Set(['fan', 'fan_generic', 'heater_fan', 'controller_fan', 'temperature_fan'])

export interface Rgbw { r: number, g: number, b: number, w: number }

export interface Output {
  key: string
  kind: OutputKind
  /** Klipper's name for it (the part after the type), used in commands. */
  name: string
  label: string
  /** Whether the UI may set it; Klipper drives heater, controller and temperature fans itself. */
  controllable: boolean
  /** 0–1, relative to max_power for fans. */
  value: number
  /** Output pins: on/off only. */
  pwm: boolean
  scale: number
  rpm: number | null
  color: Rgbw | null
  /** LEDs: whether a white channel exists. */
  hasWhite: boolean
}

type Settings = Record<string, Record<string, unknown> | undefined> | undefined

const num = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback)

/** Outputs present on the printer, fans first. Names starting with `_` are hidden, as in Klipper. */
export const listOutputs = (
  keys: string[],
  read: (key: string) => Record<string, unknown> | undefined,
  settings: Settings
): Output[] => {
  const outputs: Output[] = []

  for (const key of keys) {
    const space = key.indexOf(' ')
    const type = space === -1 ? key : key.slice(0, space)
    const name = space === -1 ? key : key.slice(space + 1)
    if (name.startsWith('_')) continue

    const isLed = LED_TYPES.has(type)
    if (!FAN_TYPES.has(type) && type !== 'output_pin' && !isLed) continue

    const state = read(key) ?? {}
    const config = settings?.[key.toLowerCase()] ?? {}
    const kind: OutputKind = isLed ? 'led' : type as OutputKind

    let value = 0
    let color: Rgbw | null = null
    if (FAN_TYPES.has(type)) {
      value = num(state.speed, 0) / (num(config.max_power, 1) || 1)
    } else if (type === 'output_pin') {
      value = num(state.value, 0)
    } else {
      const data = Array.isArray(state.color_data) ? state.color_data[0] : undefined
      const [r = 0, g = 0, b = 0, w = 0] = Array.isArray(data) ? data.map(v => num(v, 0)) : []
      color = { r, g, b, w }
      value = Math.max(r, g, b, w)
    }

    const colorOrder = typeof config.color_order === 'string' ? config.color_order : ''

    outputs.push({
      key,
      kind,
      name,
      label: kind === 'fan' ? 'Part fan' : prettyObjectName(key),
      controllable: kind === 'fan' || kind === 'fan_generic' || kind === 'led' ||
        (kind === 'output_pin' && !config.static_value),
      value: Math.min(Math.max(value, 0), 1),
      pwm: config.pwm === true,
      scale: num(config.scale, 1) || 1,
      rpm: typeof state.rpm === 'number' ? state.rpm : null,
      color,
      hasWhite: colorOrder.toUpperCase().includes('W') || typeof config.white_pin === 'string'
    })
  }

  const order: OutputKind[] = ['fan', 'fan_generic', 'heater_fan', 'controller_fan', 'temperature_fan', 'output_pin', 'led']
  return outputs.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name))
}

/** Set a fan to `fraction` (0–1). */
export const fanCommand = (output: Output, fraction: number): string | null => {
  if (output.kind === 'fan') return fraction <= 0 ? 'M107' : `M106 S${Math.round(fraction * 255)}`
  if (output.kind === 'fan_generic') {
    return `SET_FAN_SPEED FAN=${encodeParamValue(output.name)} SPEED=${Math.round(fraction * 100) / 100}`
  }
  return null
}

/** Set an output pin to `fraction` (0–1) of its scale; non-PWM pins go fully on or off. */
export const pinCommand = (output: Output, fraction: number): string => {
  const level = output.pwm ? fraction : fraction > 0 ? 1 : 0
  const value = Math.round(level * output.scale * 1000) / 1000
  return `SET_PIN PIN=${encodeParamValue(output.name)} VALUE=${value}`
}

export const ledCommand = (output: Output, color: Rgbw): string => {
  const channel = (value: number) => Math.round(Math.min(Math.max(value, 0), 1) * 1000) / 1000
  const parts = [
    `RED=${channel(color.r)}`,
    `GREEN=${channel(color.g)}`,
    `BLUE=${channel(color.b)}`,
    ...(output.hasWhite ? [`WHITE=${channel(color.w)}`] : [])
  ]
  return `SET_LED LED=${encodeParamValue(output.name)} ${parts.join(' ')}`
}

export const rgbToHex = ({ r, g, b }: Rgbw): string => `#${[r, g, b]
  .map(value => Math.round(Math.min(Math.max(value, 0), 1) * 255).toString(16).padStart(2, '0'))
  .join('')}`

export const hexToRgb = (hex: string): Pick<Rgbw, 'r' | 'g' | 'b'> => {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 }
}
