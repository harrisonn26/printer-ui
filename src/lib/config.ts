export const sameOriginUrl = (): string => {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}/websocket`
}

/**
 * Accepts what people actually type — `192.168.0.140`, `printer.local:7125`,
 * `http://host:7125`, `ws://host/websocket` — and returns a websocket URL.
 * Returns null when the input can't be made into one.
 */
export const normalizeMoonrakerUrl = (input: string, secure = false): string | null => {
  const trimmed = input.trim()
  if (!trimmed) return null

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${secure ? 'wss' : 'ws'}://${trimmed}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  const schemes: Record<string, string> = { 'http:': 'ws:', 'https:': 'wss:', 'ws:': 'ws:', 'wss:': 'wss:' }
  const protocol = schemes[url.protocol]
  if (!protocol || !url.hostname) return null

  const path = url.pathname === '/' || url.pathname === '' ? '/websocket' : url.pathname.replace(/\/+$/, '')
  return `${protocol}//${url.host}${path}`
}

/** The deploy's config.json, else this page's own host (the nginx deploy proxies Moonraker). */
export const resolveDefaultUrl = async (): Promise<string> => {
  try {
    const response = await fetch('./config.json', { cache: 'no-store' })
    if (response.ok) {
      const config: unknown = await response.json()
      if (
        config != null &&
        typeof config === 'object' &&
        'moonrakerUrl' in config &&
        typeof config.moonrakerUrl === 'string' &&
        config.moonrakerUrl
      ) {
        return config.moonrakerUrl
      }
    }
  } catch {
    // No config.json — fall through to same-origin.
  }

  return sameOriginUrl()
}
