// Viewer-grade G-code parser: extruding moves only, grouped into layers, each
// segment tagged with the byte offset of its command so Klipper's
// virtual_sdcard.file_position maps straight onto the path.
//
// Layers come from the slicer's own markers when the file has them
// (`;LAYER_CHANGE` + `;Z:` from Orca/Prusa/Bambu, `;LAYER:n` from Cura) —
// the only reliable way for spiral vase prints, where Z rises on nearly every
// move — and from Z changes otherwise. Moves before the first marker (a purge
// line in the start G-code) belong to no layer.
//
// Adapted from fluidd-lite's parser, with arcs (G2/G3 I/J) linearised.

export interface ParsedGcode {
  /** Extruding segments: start and end points. */
  x0: Float32Array
  y0: Float32Array
  x1: Float32Array
  y1: Float32Array
  /** Byte offset of the command that produced each segment. */
  byte: Uint32Array
  /** First segment index of each layer. */
  layerStart: Uint32Array
  layerZ: Float32Array
  minX: number
  minY: number
  maxX: number
  maxY: number
}

class Growable<T extends Float32Array | Uint32Array> {
  length = 0
  buffer: T
  readonly make: (size: number) => T

  constructor (buffer: T, make: (size: number) => T) {
    this.buffer = buffer
    this.make = make
  }

  push (value: number): void {
    if (this.length === this.buffer.length) {
      const next = this.make(this.buffer.length * 2)
      next.set(this.buffer)
      this.buffer = next
    }
    this.buffer[this.length++] = value
  }

  done (): T {
    return this.buffer.slice(0, this.length) as T
  }
}

const f32 = () => new Growable(new Float32Array(1024), size => new Float32Array(size))
const u32 = () => new Growable(new Uint32Array(1024), size => new Uint32Array(size))

/** Arc segments per full circle; plenty for a preview. */
const ARC_SEGMENTS_PER_TURN = 48

const CHAR = { G: 71, M: 77, X: 88, Y: 89, Z: 90, E: 69, I: 73, J: 74, SPACE: 32, ZERO: 48, NINE: 57 }

/**
 * `text` must be decoded so that one character is one byte (latin1), or the
 * recorded offsets won't line up with what Klipper reports.
 */
export const parseGcode = (text: string): ParsedGcode => {
  const x0 = f32(), y0 = f32(), x1 = f32(), y1 = f32()
  const byte = u32()
  // Z-change layers, and slicer-marker layers; the markers win if present.
  const layerStart = u32(), layerZ = f32()
  const markerStart = u32(), markerZ = f32()
  let pendingMarker = false
  let pendingMarkerZ = Number.NaN
  let lastMarkerZ = Number.NaN

  let x = 0, y = 0, z = 0, e = 0
  let absoluteXYZ = true, absoluteE = true
  let currentLayerZ = Number.NaN
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  const segment = (ax: number, ay: number, bx: number, by: number, offset: number) => {
    x0.push(ax); y0.push(ay); x1.push(bx); y1.push(by)
    byte.push(offset)
    if (ax < minX) minX = ax
    if (bx < minX) minX = bx
    if (ax > maxX) maxX = ax
    if (bx > maxX) maxX = bx
    if (ay < minY) minY = ay
    if (by < minY) minY = by
    if (ay > maxY) maxY = ay
    if (by > maxY) maxY = by
  }

  let pos = 0
  const n = text.length
  while (pos < n) {
    let eol = text.indexOf('\n', pos)
    if (eol === -1) eol = n
    const lineStart = pos
    let end = eol
    const semicolon = text.indexOf(';', pos)
    if (semicolon !== -1 && semicolon < end) end = semicolon

    let i = pos
    while (i < end && text.charCodeAt(i) === CHAR.SPACE) i++
    const letter = text.charCodeAt(i)

    // Comment-only lines: the slicer's layer markers.
    if (i === semicolon) {
      if (text.startsWith(';LAYER_CHANGE', i) || text.startsWith(';LAYER:', i)) {
        pendingMarker = true
        pendingMarkerZ = Number.NaN
      } else if (pendingMarker && text.startsWith(';Z:', i)) {
        pendingMarkerZ = Number.parseFloat(text.slice(i + 3, eol))
      }
    }

    if (letter === CHAR.G || letter === CHAR.M) {
      let code = 0
      let j = i + 1
      while (j < end) {
        const d = text.charCodeAt(j)
        if (d < CHAR.ZERO || d > CHAR.NINE) break
        code = code * 10 + (d - CHAR.ZERO)
        j++
      }
      const isG = letter === CHAR.G

      if (isG && code <= 3) {
        let nx = x, ny = y, nz = z, de = 0, ci = 0, cj = 0, sawE = false
        while (j < end) {
          const word = text.charCodeAt(j)
          if (word === CHAR.SPACE) { j++; continue }
          let k = j + 1
          while (k < end && text.charCodeAt(k) !== CHAR.SPACE) k++
          const value = Number.parseFloat(text.slice(j + 1, k))
          if (!Number.isNaN(value)) {
            if (word === CHAR.X) nx = absoluteXYZ ? value : x + value
            else if (word === CHAR.Y) ny = absoluteXYZ ? value : y + value
            else if (word === CHAR.Z) nz = absoluteXYZ ? value : z + value
            else if (word === CHAR.E) { de = absoluteE ? value - e : value; sawE = true }
            else if (word === CHAR.I) ci = value
            else if (word === CHAR.J) cj = value
          }
          j = k
        }

        const moved = nx !== x || ny !== y
        if (de > 0 && (moved || code >= 2)) {
          // Z-hops are travels, so only an extruding move opens a layer.
          if (nz !== currentLayerZ) {
            currentLayerZ = nz
            layerStart.push(x0.length)
            layerZ.push(nz)
          }
          // A marker opens its layer at the first extrusion after it, so
          // markers with nothing printed after them make no empty layers.
          // A marker repeating the previous layer's Z (Orca's closing spiral
          // pass) continues that layer rather than adding one.
          if (pendingMarker) {
            pendingMarker = false
            const markedZ = Number.isNaN(pendingMarkerZ) ? nz : pendingMarkerZ
            if (markerZ.length === 0 || Math.abs(markedZ - lastMarkerZ) > 1e-6) {
              markerStart.push(x0.length)
              markerZ.push(markedZ)
              lastMarkerZ = markedZ
            }
          }

          if (code >= 2 && (ci !== 0 || cj !== 0)) {
            const cx = x + ci, cy = y + cj
            const radius = Math.hypot(ci, cj)
            const start = Math.atan2(y - cy, x - cx)
            let sweep = Math.atan2(ny - cy, nx - cx) - start
            const clockwise = code === 2
            if (clockwise && sweep >= 0) sweep -= 2 * Math.PI
            if (!clockwise && sweep <= 0) sweep += 2 * Math.PI
            const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (2 * Math.PI) * ARC_SEGMENTS_PER_TURN))
            let px = x, py = y
            for (let s = 1; s <= steps; s++) {
              const angle = start + (sweep * s) / steps
              const qx = s === steps ? nx : cx + radius * Math.cos(angle)
              const qy = s === steps ? ny : cy + radius * Math.sin(angle)
              segment(px, py, qx, qy, lineStart)
              px = qx
              py = qy
            }
          } else if (moved) {
            segment(x, y, nx, ny, lineStart)
          }
        }

        x = nx
        y = ny
        z = nz
        if (absoluteE && sawE) e += de
      } else if (isG && code === 90) {
        absoluteXYZ = true
      } else if (isG && code === 91) {
        absoluteXYZ = false
      } else if (isG && code === 92) {
        while (j < end) {
          const word = text.charCodeAt(j)
          if (word === CHAR.SPACE) { j++; continue }
          let k = j + 1
          while (k < end && text.charCodeAt(k) !== CHAR.SPACE) k++
          if (word === CHAR.E) e = Number.parseFloat(text.slice(j + 1, k)) || 0
          j = k
        }
      } else if (isG && code === 28) {
        x = 0
        y = 0
        z = 0
      } else if (!isG && code === 82) {
        absoluteE = true
      } else if (!isG && code === 83) {
        absoluteE = false
      }
    }
    pos = eol + 1
  }

  const useMarkers = markerStart.length > 0
  const starts = useMarkers ? markerStart.done() : layerStart.done()
  const zs = useMarkers ? markerZ.done() : layerZ.done()
  const xs0 = x0.done(), ys0 = y0.done(), xs1 = x1.done(), ys1 = y1.done()

  // Frame the model, not the start G-code: skip moves before the first layer.
  const first = starts[0] ?? 0
  if (first > 0) {
    minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity
    for (let i = first; i < xs0.length; i++) {
      minX = Math.min(minX, xs0[i]!, xs1[i]!)
      maxX = Math.max(maxX, xs0[i]!, xs1[i]!)
      minY = Math.min(minY, ys0[i]!, ys1[i]!)
      maxY = Math.max(maxY, ys0[i]!, ys1[i]!)
    }
  }

  return {
    x0: xs0, y0: ys0, x1: xs1, y1: ys1,
    byte: byte.done(),
    layerStart: starts,
    layerZ: zs,
    minX: Number.isFinite(minX) ? minX : 0,
    minY: Number.isFinite(minY) ? minY : 0,
    maxX: Number.isFinite(maxX) ? maxX : 0,
    maxY: Number.isFinite(maxY) ? maxY : 0
  }
}

/** Index of the last element <= value in a sorted array, or -1. */
export const lastAtOrBefore = (sorted: ArrayLike<number>, value: number): number => {
  let lo = 0, hi = sorted.length - 1, found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((sorted[mid] ?? 0) <= value) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

/** [first, end) segment indices of a layer. */
export const layerRange = (parsed: ParsedGcode, layer: number): [number, number] => [
  parsed.layerStart[layer] ?? 0,
  parsed.layerStart[layer + 1] ?? parsed.x0.length
]
