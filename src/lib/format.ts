export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${s}s`
}

export const formatTemp = (value: number | null | undefined): string => (
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(1)
)

const NAMES: Record<string, string> = {
  extruder: 'Extruder',
  heater_bed: 'Bed'
}

/** `heater_generic chamber` → `Chamber`, `extruder1` → `Extruder 1`. */
export const prettyObjectName = (key: string): string => {
  const known = NAMES[key]
  if (known) return known

  const extruder = /^extruder(\d+)$/.exec(key)
  if (extruder) return `Extruder ${extruder[1]}`

  const name = key.includes(' ') ? key.slice(key.indexOf(' ') + 1) : key
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

export const fileBasename = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
