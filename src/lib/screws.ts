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
