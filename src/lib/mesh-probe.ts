// Live bed mesh calibration progress, read from Klipper's console output.
// Each probe sample is reported as `probe at X,Y is z=Z`, at the toolhead's
// position; the mesh point is that plus the probe's XY offset, and its mesh
// value is Z minus the probe's z_offset (as bed_mesh computes it).

export interface ProbeSample {
  x: number
  y: number
  z: number
}

const PROBE_LINE = /probe at (-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?) is z=(-?\d+(?:\.\d+)?)/i

export const parseProbeLine = (message: string): ProbeSample | null => {
  const match = PROBE_LINE.exec(message)
  if (!match) return null
  return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) }
}

export interface MeshGrid {
  min: [number, number]
  max: [number, number]
  /** Points along X, then Y. */
  count: [number, number]
}

export interface ProbeOffsets {
  x: number
  y: number
  z: number
}

/** The configured grid, from `[bed_mesh]` settings. Null for round beds or odd configs. */
export const meshGridFromSettings = (bedMesh: object | undefined): MeshGrid | null => {
  if (!bedMesh) return null
  const settings: Record<string, unknown> = { ...bedMesh }
  const pair = (value: unknown): [number, number] | null => {
    if (typeof value === 'number') return [value, value]
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') return [value[0], value[1]]
    return null
  }
  const min = pair(settings.mesh_min)
  const max = pair(settings.mesh_max)
  const count = pair(settings.probe_count)
  if (!min || !max || !count) return null
  return { min, max, count }
}

export const probeOffsetsFromSettings = (
  settings: Record<string, Record<string, unknown> | undefined> | undefined
): ProbeOffsets => {
  const section = settings?.bltouch ?? settings?.probe ?? settings?.['probe_eddy_current'] ?? settings?.beacon ?? {}
  const num = (value: unknown) => (typeof value === 'number' ? value : 0)
  return { x: num(section.x_offset), y: num(section.y_offset), z: num(section.z_offset) }
}

export interface ProbeProgress {
  /** rows[y][x], front to back; null until probed. */
  values: (number | null)[][]
  done: number
  total: number
  /** Grid cell of the latest sample, if it landed on the grid. */
  current: [number, number] | null
  /** Samples that didn't match a grid point (adaptive meshes, other probing). */
  offGrid: number
}

/**
 * Place samples on the grid. With several samples per point the latest one
 * wins while probing; Klipper's final mesh (which may use the median) replaces
 * the whole view when it lands.
 */
export const probeProgress = (
  samples: ProbeSample[],
  grid: MeshGrid,
  offsets: ProbeOffsets,
  tolerance = 1.5
): ProbeProgress => {
  const [countX, countY] = grid.count
  const values: (number | null)[][] = Array.from({ length: countY }, () => Array<number | null>(countX).fill(null))
  const step = (axis: 0 | 1, count: number) => (count > 1 ? (grid.max[axis] - grid.min[axis]) / (count - 1) : 0)
  const stepX = step(0, countX)
  const stepY = step(1, countY)

  let done = 0
  let current: [number, number] | null = null
  let offGrid = 0

  for (const sample of samples) {
    const px = sample.x + offsets.x
    const py = sample.y + offsets.y
    const ix = stepX ? Math.round((px - grid.min[0]) / stepX) : 0
    const iy = stepY ? Math.round((py - grid.min[1]) / stepY) : 0
    const onGrid = ix >= 0 && ix < countX && iy >= 0 && iy < countY &&
      Math.abs(grid.min[0] + ix * stepX - px) <= tolerance &&
      Math.abs(grid.min[1] + iy * stepY - py) <= tolerance
    if (!onGrid) {
      offGrid++
      continue
    }
    const row = values[iy]!
    if (row[ix] == null) done++
    row[ix] = sample.z - offsets.z
    current = [ix, iy]
  }

  return { values, done, total: countX * countY, current, offGrid }
}
