// Sorting a Klipper config folder into the files you edit and their backups.
//
// Backups come from several places, all recognised:
// - Klipper's SAVE_CONFIG:      printer-20260921_091053.cfg      → printer.cfg
// - hand-made copies:           printer.cfg.pre-bltouch, .bak-…  → printer.cfg
// - Moonraker's own:            .moonraker.conf.bkp              → moonraker.conf
// - this app, before each save: .printer-ui/backups/printer.cfg.20260930-141502

export const BACKUP_DIR = '.printer-ui/backups'

const EDITABLE = /\.(cfg|conf)$/i
const KLIPPER_BACKUP = /^(.*)-(\d{8})_(\d{6})\.cfg$/
const APP_BACKUP = new RegExp(`^${BACKUP_DIR.replace(/\./g, '\\.')}/(.+)\\.(\\d{8})-(\\d{6})$`)

export interface ConfigFile {
  path: string
  size: number
  modified: number
}

export interface Backup extends ConfigFile {
  /** Where it came from, for the label. */
  kind: 'klipper' | 'app' | 'copy'
  /** When it was taken: from its name when that carries a time, else its mtime. */
  taken: number
}

const stampToTime = (date: string, time: string): number => new Date(
  Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)),
  Number(time.slice(0, 2)), Number(time.slice(2, 4)), Number(time.slice(4, 6))
).getTime()

/** A backup's original, given the set of real files; null when it isn't a backup. */
export const backupTarget = (path: string, originals: Set<string>): { original: string, kind: Backup['kind'], taken: number | null } | null => {
  const app = APP_BACKUP.exec(path)
  if (app) return { original: app[1]!, kind: 'app', taken: stampToTime(app[2]!, app[3]!) }

  const klipper = KLIPPER_BACKUP.exec(path)
  if (klipper && originals.has(`${klipper[1]}.cfg`)) {
    return { original: `${klipper[1]}.cfg`, kind: 'klipper', taken: stampToTime(klipper[2]!, klipper[3]!) }
  }

  // `printer.cfg.anything`, and Moonraker's `.moonraker.conf.bkp`.
  const slash = path.lastIndexOf('/')
  const dir = path.slice(0, slash + 1)
  const name = path.slice(slash + 1).replace(/^\./, '')
  for (const original of originals) {
    const originalName = original.slice(original.lastIndexOf('/') + 1)
    if (original.startsWith(dir) && original.slice(dir.length) === originalName && name.startsWith(`${originalName}.`)) {
      return { original, kind: 'copy', taken: null }
    }
  }
  return null
}

export interface ConfigTree {
  files: ConfigFile[]
  backups: Map<string, Backup[]>
}

/** Editable files (printer.cfg first), and each one's backups, newest first. */
export const sortConfigFiles = (entries: ConfigFile[]): ConfigTree => {
  const originals = new Set(entries.map(entry => entry.path).filter(path => EDITABLE.test(path) && backupTargetLoose(path) === null))
  const backups = new Map<string, Backup[]>()
  const files: ConfigFile[] = []

  for (const entry of entries) {
    const target = backupTarget(entry.path, originals)
    if (target && originals.has(target.original) && entry.path !== target.original) {
      const list = backups.get(target.original) ?? []
      list.push({ ...entry, kind: target.kind, taken: target.taken ?? entry.modified * 1000 })
      backups.set(target.original, list)
    } else if (originals.has(entry.path)) {
      files.push(entry)
    }
  }

  for (const list of backups.values()) list.sort((a, b) => b.taken - a.taken)
  const rank = (path: string) => (path === 'printer.cfg' ? 0 : path === 'moonraker.conf' ? 2 : 1)
  files.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path))
  return { files, backups }
}

/** Klipper's own timestamped backups end in .cfg too; keep them out of the originals. */
const backupTargetLoose = (path: string): string | null => {
  if (path.startsWith(`${BACKUP_DIR}/`)) return path
  const klipper = KLIPPER_BACKUP.exec(path)
  return klipper ? `${klipper[1]}.cfg` : null
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Where the app keeps the copy it takes before saving `path`. */
export const appBackupPath = (path: string, now = new Date()): string => {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${BACKUP_DIR}/${path}.${date}-${time}`
}

/** Files that Klipper reads; saving moonraker.conf restarts Moonraker instead. */
export const restartTarget = (path: string): 'klipper' | 'moonraker' => (
  /(^|\/)moonraker\.conf$/.test(path) ? 'moonraker' : 'klipper'
)
