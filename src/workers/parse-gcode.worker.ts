import { parseGcode, type ParsedGcode } from '../lib/gcode-parse'

export type ParseRequest = { url: string }
export type ParseResponse =
  | { ok: true, parsed: ParsedGcode }
  | { ok: false, error: string }

self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  try {
    const response = await fetch(event.data.url)
    if (!response.ok) throw new Error(`Couldn't download the file (HTTP ${response.status})`)
    // latin1: one char per byte, so offsets match Klipper's file_position.
    const text = new TextDecoder('latin1').decode(await response.arrayBuffer())
    const parsed = parseGcode(text)
    const message: ParseResponse = { ok: true, parsed }
    self.postMessage(message, {
      transfer: [parsed.x0, parsed.y0, parsed.x1, parsed.y1, parsed.byte, parsed.layerStart, parsed.layerZ]
        .map(array => array.buffer as ArrayBuffer)
    })
  } catch (error) {
    const message: ParseResponse = { ok: false, error: error instanceof Error ? error.message : String(error) }
    self.postMessage(message)
  }
}
