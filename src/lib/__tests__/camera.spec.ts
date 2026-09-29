import { cameraMode, cameraTransform, resolveCameraUrl } from '../camera'

const camera = (entry: Partial<Moonraker.Webcam.Entry>): Moonraker.Webcam.Entry => ({
  source: 'database',
  uid: 'cam',
  ...entry
})

describe('cameraMode', () => {
  it.each([
    [{ service: 'mjpegstreamer', stream_url: '/webcam/?action=stream' }, 'stream'],
    [{ service: 'mjpegstreamer', snapshot_url: '/webcam/?action=snapshot' }, 'snapshots'],
    [{ service: 'mjpegstreamer-adaptive', snapshot_url: '/webcam/?action=snapshot' }, 'snapshots'],
    [{ service: 'iframe', stream_url: 'http://cam.local' }, 'iframe'],
    [{ service: 'webrtc-camerastreamer', stream_url: '/webcam/webrtc' }, 'unsupported'],
    [{ service: 'hlsstream', stream_url: '/hls', snapshot_url: '/snap' }, 'snapshots']
  ] as const)('%o → %s', (entry, expected) => {
    expect(cameraMode(camera(entry))).toBe(expected)
  })
})

describe('resolveCameraUrl', () => {
  it('keeps absolute URLs', () => {
    expect(resolveCameraUrl('http://cam.local:8080/stream', 'ws://printer:7125/websocket', 'http://localhost:5173/'))
      .toBe('http://cam.local:8080/stream')
  })

  it('resolves against the page when served from the printer host', () => {
    expect(resolveCameraUrl('/webcam/?action=stream', 'ws://printer:4411/websocket', 'http://printer:4411/'))
      .toBe('http://printer:4411/webcam/?action=stream')
  })

  it('resolves against the printer host on the default port otherwise', () => {
    expect(resolveCameraUrl('/webcam/?action=stream', 'ws://192.168.0.140:7125/websocket', 'http://localhost:5173/'))
      .toBe('http://192.168.0.140/webcam/?action=stream')
    expect(resolveCameraUrl('/webcam/', 'wss://printer.example/websocket', 'https://other.example/'))
      .toBe('https://printer.example/webcam/')
  })
})

describe('cameraTransform', () => {
  it('combines rotation and flips', () => {
    expect(cameraTransform(camera({ rotation: 180, flip_horizontal: true }))).toBe('rotate(180deg) scaleX(-1)')
    expect(cameraTransform(camera({}))).toBeUndefined()
  })
})
