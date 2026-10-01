// SCREWS_TILT_CALCULATE reports each turn as HH:MM on a clock face, where a
// full hour is one full turn. Say it in turns instead, to the nearest eighth.

const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞']

/** "¼ turn CW", "1½ turns CCW", "< ⅛ turn CW"; null when the time doesn't parse. */
export const screwTurn = (sign: string, adjust: string): string | null => {
  const match = /^(\d+):(\d+)$/.exec(adjust.trim())
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  const eighths = Math.round(minutes / 7.5)
  const direction = sign.trim().toUpperCase()
  if (eighths === 0) return minutes === 0 ? 'No turn' : `< ⅛ turn ${direction}`
  const whole = Math.floor(eighths / 8)
  const amount = `${whole || ''}${EIGHTHS[eighths % 8]}`
  return `${amount} turn${eighths > 8 ? 's' : ''} ${direction}`
}

/** The clock reading as a share of one full turn: "00:15" → 0.25. */
export const turnFraction = (adjust: string): number | null => {
  const match = /^(\d+):(\d+)$/.exec(adjust.trim())
  return match ? (Number(match[1]) * 60 + Number(match[2])) / 60 : null
}

/** A screw's x, y from configfile settings, which give either [x, y] or "x, y". */
export const screwPosition = (value: unknown): [number, number] | null => {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const [x, y] = parts.map(part => Number(part))
  return parts.length >= 2 && Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null
}

/** SVG path for a wedge of `fraction` of a circle, from 12 o'clock, clockwise or not. */
export const wedgePath = (fraction: number, clockwise: boolean, radius = 1): string => {
  const share = Math.min(Math.max(fraction, 0), 1)
  if (share >= 0.999) return `M 0 ${-radius} A ${radius} ${radius} 0 1 1 0 ${radius} A ${radius} ${radius} 0 1 1 0 ${-radius} Z`
  const angle = share * 2 * Math.PI * (clockwise ? 1 : -1)
  const x = Math.sin(angle) * radius
  const y = -Math.cos(angle) * radius
  const round = (value: number) => Math.round(value * 1000) / 1000
  return `M 0 0 L 0 ${-radius} A ${radius} ${radius} 0 ${share > 0.5 ? 1 : 0} ${clockwise ? 1 : 0} ${round(x)} ${round(y)} Z`
}
