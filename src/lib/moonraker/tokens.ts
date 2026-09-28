// JWT storage and the refresh policy, ported from Fluidd's `getAccessToken`
// (src/store/socket/actions.ts), GPL-3.0.

import { jwtDecode } from 'jwt-decode'
import { isUnauthorizedError } from './errors'

export interface TokenStore {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
  remove: (key: string) => void
}

export const browserTokenStore: TokenStore = {
  get: key => {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
  },
  remove: key => {
    try { localStorage.removeItem(key) } catch { /* storage unavailable */ }
  }
}

/** Tokens are per printer: one browser can hold sessions for several. */
export const tokenKeys = (url: string) => ({
  access: `printer-ui:access-token:${url}`,
  refresh: `printer-ui:refresh-token:${url}`
})

export const isTokenExpired = (token: string, now = Date.now()): boolean => {
  try {
    const { exp } = jwtDecode(token)
    return exp !== undefined && exp * 1000 < now
  } catch {
    return true
  }
}

type RefreshJwt = (refreshToken: string) => Promise<Moonraker.Authorization.RefreshJwtResponse>

/**
 * - valid access token → use it
 * - expired access token + valid refresh token → refresh and use the new one
 * - refresh rejected as unauthorized, or nothing usable → clear both, identify anonymously
 * - refresh failed for any other reason (socket drop) → keep both, return null;
 *   the next identify retries
 */
export const getAccessToken = async (
  url: string,
  refreshJwt: RefreshJwt,
  store: TokenStore = browserTokenStore
): Promise<string | null> => {
  const keys = tokenKeys(url)
  const token = store.get(keys.access)
  if (token && !isTokenExpired(token)) return token

  const refreshToken = store.get(keys.refresh)
  if (refreshToken && !isTokenExpired(refreshToken)) {
    try {
      const response = await refreshJwt(refreshToken)
      if (response.token) {
        store.set(keys.access, response.token)
        return response.token
      }
    } catch (error) {
      if (!isUnauthorizedError(error)) return null
    }
  }

  store.remove(keys.access)
  store.remove(keys.refresh)
  return null
}

export const saveTokens = (
  url: string,
  tokens: { token: string, refresh_token: string },
  store: TokenStore = browserTokenStore
): void => {
  const keys = tokenKeys(url)
  store.set(keys.access, tokens.token)
  store.set(keys.refresh, tokens.refresh_token)
}

export const clearTokens = (url: string, store: TokenStore = browserTokenStore): void => {
  const keys = tokenKeys(url)
  store.remove(keys.access)
  store.remove(keys.refresh)
}
