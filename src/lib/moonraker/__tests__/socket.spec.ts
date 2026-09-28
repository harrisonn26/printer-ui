import type { Mock } from 'vitest'
import { MoonrakerSocket, type SocketHandlers } from '../socket'

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null

  constructor (readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  send (data: string) { this.sent.push(data) }
  close () { this.readyState = FakeWebSocket.CLOSED }

  open () {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  receive (message: object) { this.onmessage?.({ data: JSON.stringify(message) }) }

  drop () {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

const handlers = (): { [K in keyof SocketHandlers]: Mock<SocketHandlers[K]> } => ({
  onOpen: vi.fn<SocketHandlers['onOpen']>(),
  onClose: vi.fn<SocketHandlers['onClose']>(),
  onNotify: vi.fn<SocketHandlers['onNotify']>(),
  onStatusUpdate: vi.fn<SocketHandlers['onStatusUpdate']>(),
  onFastUpdate: vi.fn<SocketHandlers['onFastUpdate']>()
})

const status = (params: object) => ({ jsonrpc: '2.0', method: 'notify_status_update', params: [params, 0] })

describe('MoonrakerSocket', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const connect = () => {
    const h = handlers()
    const socket = new MoonrakerSocket(h)
    socket.connect('ws://printer/websocket')
    const ws = FakeWebSocket.instances.at(-1)!
    ws.open()
    return { h, socket, ws }
  }

  it('resolves and rejects calls by id', async () => {
    const { socket, ws } = connect()

    const ok = socket.call('server.info')
    const bad = socket.call('nope')
    const [first, second] = ws.sent.map(data => JSON.parse(data).id)

    ws.receive({ jsonrpc: '2.0', id: first, result: { ok: true } })
    ws.receive({ jsonrpc: '2.0', id: second, error: { code: -32601, message: 'Method not found' } })

    await expect(ok).resolves.toEqual({ ok: true })
    await expect(bad).rejects.toEqual({ code: -32601, message: 'Method not found' })
  })

  it('flushes the first status update immediately, then batches for a second', () => {
    const { h, ws } = connect()

    ws.receive(status({ extruder: { temperature: 20 } }))
    expect(h.onStatusUpdate).toHaveBeenCalledTimes(1)

    ws.receive(status({ extruder: { temperature: 21 } }))
    ws.receive(status({ extruder: { target: 200 }, heater_bed: { temperature: 50 } }))
    expect(h.onStatusUpdate).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    expect(h.onStatusUpdate).toHaveBeenCalledTimes(2)
    expect(h.onStatusUpdate).toHaveBeenLastCalledWith({
      extruder: { temperature: 21, target: 200 },
      heater_bed: { temperature: 50 }
    })
  })

  it('sends motion_report straight through', () => {
    const { h, ws } = connect()

    ws.receive(status({ extruder: { temperature: 20 } }))
    ws.receive(status({ motion_report: { live_position: [1, 2, 3, 4] } }))

    expect(h.onFastUpdate).toHaveBeenCalledWith('motion_report', { live_position: [1, 2, 3, 4] })
    expect(h.onStatusUpdate).toHaveBeenCalledTimes(1)
  })

  it('rejects in-flight calls and schedules a retry when the socket drops', async () => {
    const { h, socket, ws } = connect()

    const pending = socket.call('server.info')
    ws.drop()

    await expect(pending).rejects.toThrow('Socket closed')
    expect(h.onClose).toHaveBeenCalledWith(1400)

    vi.advanceTimersByTime(1400)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('does not retry after close()', () => {
    const { h, socket, ws } = connect()

    socket.close()
    ws.drop()

    expect(h.onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(20_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})
