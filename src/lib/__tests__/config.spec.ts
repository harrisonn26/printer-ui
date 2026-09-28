import { normalizeMoonrakerUrl } from '../config'

describe('normalizeMoonrakerUrl', () => {
  it.each([
    ['192.168.0.140', 'ws://192.168.0.140/websocket'],
    ['192.168.0.140:7125', 'ws://192.168.0.140:7125/websocket'],
    ['printer.local:7125/', 'ws://printer.local:7125/websocket'],
    ['http://printer.local:7125', 'ws://printer.local:7125/websocket'],
    ['https://printer.example', 'wss://printer.example/websocket'],
    ['ws://host/websocket', 'ws://host/websocket'],
    ['  wss://host:7125/moonraker/websocket/  ', 'wss://host:7125/moonraker/websocket']
  ])('%s → %s', (input, expected) => {
    expect(normalizeMoonrakerUrl(input)).toBe(expected)
  })

  it('uses wss for bare hosts on a secure page', () => {
    expect(normalizeMoonrakerUrl('host', true)).toBe('wss://host/websocket')
  })

  it.each(['', '   ', 'ftp://host', 'http://'])('rejects %j', input => {
    expect(normalizeMoonrakerUrl(input)).toBeNull()
  })
})
