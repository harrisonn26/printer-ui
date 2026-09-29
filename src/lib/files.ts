/** Moonraker's HTTP origin, derived from its websocket URL. */
export const httpBase = (moonrakerUrl: string): string => {
  const url = new URL(moonrakerUrl)
  return `${url.protocol === 'wss:' ? 'https' : 'http'}://${url.host}`
}

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/')

/** A file's folder within the gcodes root, with a trailing slash ('' for the root). */
export const dirOf = (path: string): string => {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash + 1)
}

/**
 * The thumbnail to show at about `targetWidth` CSS px: the smallest one at
 * least that wide, else the largest there is.
 */
export const pickThumbnail = (
  thumbnails: Moonraker.Files.MetadataThumbnail[] | undefined,
  targetWidth: number
): Moonraker.Files.MetadataThumbnail | undefined => {
  if (!thumbnails?.length) return undefined
  const bySize = [...thumbnails].sort((a, b) => a.width - b.width)
  return bySize.find(thumbnail => thumbnail.width >= targetWidth) ?? bySize.at(-1)
}

/** URL of a gcode's thumbnail; `relative_path` is relative to the file's folder. */
export const thumbnailUrl = (
  moonrakerUrl: string,
  filePath: string,
  thumbnail: Moonraker.Files.MetadataThumbnail
): string => `${httpBase(moonrakerUrl)}/server/files/gcodes/${encodePath(dirOf(filePath) + thumbnail.relative_path)}`

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const date = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

/** `3 min ago`, `yesterday`, then a date past a week. Takes Unix seconds. */
export const formatAgo = (seconds: number, now = Date.now()): string => {
  const diff = (seconds * 1000 - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return relative.format(0, 'second')
  if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute')
  if (abs < 86_400) return relative.format(Math.round(diff / 3600), 'hour')
  if (abs < 7 * 86_400) return relative.format(Math.round(diff / 86_400), 'day')
  return date.format(seconds * 1000)
}
