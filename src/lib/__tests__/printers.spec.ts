import type { TokenStore } from '../moonraker/tokens'
import { Printers, parseStoredPrinters, printerLabel } from '../printers.svelte'

const memoryStore = (initial: Record<string, string> = {}): TokenStore & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get: key => data.get(key) ?? null,
    set: (key, value) => { data.set(key, value) },
    remove: key => { data.delete(key) }
  }
}

describe('Printers', () => {
  it('seeds the list with the default address on first run', () => {
    const printers = new Printers(memoryStore())
    printers.init('ws://printer/websocket')
    expect(printers.list).toHaveLength(1)
    expect(printers.active?.url).toBe('ws://printer/websocket')
  })

  it('migrates a single saved address from before the list existed', () => {
    const store = memoryStore({ 'printer-ui:moonraker-url': 'ws://192.168.0.140:7126/websocket' })
    const printers = new Printers(store)
    printers.init('ws://default/websocket')
    expect(printers.active?.url).toBe('ws://192.168.0.140:7126/websocket')
    expect(store.data.has('printer-ui:moonraker-url')).toBe(false)
  })

  it('adds, selects and remembers the active printer', () => {
    const store = memoryStore()
    const printers = new Printers(store)
    printers.init('ws://a/websocket')
    const added = printers.add('Ender 5', '192.168.0.140:7126')
    expect(added?.url).toBe('ws://192.168.0.140:7126/websocket')
    printers.select(added!.id)

    const reloaded = new Printers(store)
    reloaded.init('ws://a/websocket')
    expect(reloaded.active?.name).toBe('Ender 5')
    expect(reloaded.list).toHaveLength(2)
  })

  it('rejects unusable addresses', () => {
    const printers = new Printers(memoryStore())
    printers.init('ws://a/websocket')
    expect(printers.add('Bad', '   ')).toBeNull()
    expect(printers.update(printers.active!.id, { address: 'ftp://x' })).toBe(false)
  })

  it('never removes the active or the last printer', () => {
    const printers = new Printers(memoryStore())
    printers.init('ws://a/websocket')
    const first = printers.active!.id
    expect(printers.remove(first)).toBe(false)
    const other = printers.add('Other', 'b:7125')!
    expect(printers.remove(other.id)).toBe(true)
    expect(printers.list.map(entry => entry.id)).toEqual([first])
  })
})

describe('parseStoredPrinters', () => {
  it('drops malformed entries and bad JSON', () => {
    expect(parseStoredPrinters('[{"id":"a","name":"","url":"ws://x"},{"id":1}]')).toEqual([{ id: 'a', name: '', url: 'ws://x' }])
    expect(parseStoredPrinters('not json')).toEqual([])
  })
})

describe('printerLabel', () => {
  const entry = { id: 'a', name: '', url: 'ws://192.168.0.140:7126/websocket' }
  it('prefers the name, then the hostname, then the address', () => {
    expect(printerLabel({ ...entry, name: ' Ender 5 ' })).toBe('Ender 5')
    expect(printerLabel(entry, 'debian')).toBe('debian')
    expect(printerLabel(entry)).toBe('192.168.0.140:7126')
  })
})
