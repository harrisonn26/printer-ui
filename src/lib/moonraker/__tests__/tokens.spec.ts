import { getAccessToken, tokenKeys, type TokenStore } from '../tokens'

const URL = 'ws://printer/websocket'
const keys = tokenKeys(URL)

// Unsigned JWTs are enough: only `exp` is read.
const jwt = (expSeconds: number) => {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '')
  return `${encode({ alg: 'none' })}.${encode({ exp: expSeconds })}.sig`
}
const future = () => jwt(Math.floor(Date.now() / 1000) + 3600)
const past = () => jwt(Math.floor(Date.now() / 1000) - 3600)

const memoryStore = (initial: Record<string, string> = {}): TokenStore & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get: key => data.get(key) ?? null,
    set: (key, value) => { data.set(key, value) },
    remove: key => { data.delete(key) }
  }
}

describe('getAccessToken', () => {
  it('uses a valid access token without refreshing', async () => {
    const token = future()
    const store = memoryStore({ [keys.access]: token })
    const refresh = vi.fn()

    await expect(getAccessToken(URL, refresh, store)).resolves.toBe(token)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes an expired access token and stores the new one', async () => {
    const store = memoryStore({ [keys.access]: past(), [keys.refresh]: future() })
    const refresh = vi.fn().mockResolvedValue({ token: 'fresh' })

    await expect(getAccessToken(URL, refresh, store)).resolves.toBe('fresh')
    expect(store.data.get(keys.access)).toBe('fresh')
  })

  it('clears both tokens when the refresh is rejected as unauthorized', async () => {
    const store = memoryStore({ [keys.access]: past(), [keys.refresh]: future() })
    const refresh = vi.fn().mockRejectedValue({ code: -32602, message: 'Unauthorized' })

    await expect(getAccessToken(URL, refresh, store)).resolves.toBeNull()
    expect(store.data.size).toBe(0)
  })

  it('keeps both tokens when the refresh fails transiently', async () => {
    const refreshToken = future()
    const store = memoryStore({ [keys.access]: past(), [keys.refresh]: refreshToken })
    const refresh = vi.fn().mockRejectedValue(new Error('Socket closed'))

    await expect(getAccessToken(URL, refresh, store)).resolves.toBeNull()
    expect(store.data.get(keys.refresh)).toBe(refreshToken)
  })

  it('clears both tokens when nothing is usable', async () => {
    const store = memoryStore({ [keys.access]: past(), [keys.refresh]: past() })

    await expect(getAccessToken(URL, vi.fn(), store)).resolves.toBeNull()
    expect(store.data.size).toBe(0)
  })
})
