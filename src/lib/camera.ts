export type CameraMode = 'stream' | 'snapshots' | 'iframe' | 'unsupported'

/** How we can show a camera. WebRTC and HLS services aren't handled yet. */
export const cameraMode = (camera: Moonraker.Webcam.Entry): CameraMode => {
  switch (camera.service ?? 'mjpegstreamer') {
    case 'mjpegstreamer':
    case 'uv4l-mjpeg':
    case 'ipstream':
      return camera.stream_url ? 'stream' : camera.snapshot_url ? 'snapshots' : 'unsupported'
    case 'mjpegstreamer-adaptive':
      return camera.snapshot_url ? 'snapshots' : 'unsupported'
    case 'iframe':
      return camera.stream_url ? 'iframe' : 'unsupported'
    default:
      return camera.snapshot_url ? 'snapshots' : 'unsupported'
  }
}

/**
 * Camera URLs are usually relative (`/webcam/?action=stream`), served by the
 * web server on the printer host. When the page itself comes from that host,
 * resolve against the page; otherwise against the printer host on the
 * default port — not Moonraker's API port.
 */
export const resolveCameraUrl = (url: string, moonrakerUrl: string, pageUrl: string): string => {
  const page = new URL(pageUrl)
  let base = page.origin
  try {
    const moonraker = new URL(moonrakerUrl)
    if (moonraker.host !== page.host) {
      base = `${moonraker.protocol === 'wss:' ? 'https' : 'http'}://${moonraker.hostname}`
    }
  } catch {
    // Fall back to the page origin.
  }
  return new URL(url, base).toString()
}

/** CSS transform for a camera's configured rotation and flips. */
export const cameraTransform = (camera: Moonraker.Webcam.Entry): string | undefined => {
  const parts: string[] = []
  if (camera.rotation) parts.push(`rotate(${camera.rotation}deg)`)
  if (camera.flip_horizontal) parts.push('scaleX(-1)')
  if (camera.flip_vertical) parts.push('scaleY(-1)')
  return parts.length ? parts.join(' ') : undefined
}
