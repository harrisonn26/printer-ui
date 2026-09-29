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

const ACRONYMS = new Set(['mcu', 'cpu', 'soc', 'ntc', 'pt100', 'pt1000'])

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
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(word => ACRONYMS.has(word.toLowerCase())
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const fileBasename = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

// Orca's default output name is `{input_filename_base}_{filament_type}_{print_time}`,
// e.g. `Skadis universal mount slot_PLA_1h16m.gcode`.
const SLICER_SUFFIX = /_[A-Za-z0-9+-]+_(?=\d)(?:\d+d)?(?:\d+h)?(?:\d+m)?(?:\d+s)?$/

/** A job's display name: no folder, no extension, no slicer suffix. */
export const jobTitle = (path: string): string => {
  const base = fileBasename(path).replace(/\.(gcode|g|gco|bgcode)$/i, '')
  return base.replace(SLICER_SUFFIX, '') || base
}

/**
 * Slicer object names as people know them: `MAIN-BODY.STL_ID_0_COPY_0` →
 * `MAIN-BODY`, with a copy number when there is more than one.
 */
export const objectLabel = (name: string): string => {
  const copy = /_ID_\d+_COPY_(\d+)$/i.exec(name)
  const base = name
    .replace(/_ID_\d+_COPY_\d+$/i, '')
    .replace(/\.(stl|3mf|obj|step|stp|amf)$/i, '')
  const copyNumber = copy ? Number(copy[1]) : 0
  return copyNumber > 0 ? `${base} #${copyNumber + 1}` : base
}
