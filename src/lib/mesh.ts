export interface Mesh {
  name: string
  /** Rows run front to back (increasing Y); columns left to right (increasing X). */
  points: number[][]
  min: [number, number]
  max: [number, number]
  /** Loaded in Klipper right now, as opposed to a saved profile. */
  active: boolean
}

const hasPoints = (points: number[][] | undefined): points is number[][] => (
  !!points && points.length > 0 && (points[0]?.length ?? 0) > 0
)

/** The mesh Klipper is applying, if any. */
export const activeMesh = (state: Klipper.BedMeshState | undefined): Mesh | null => {
  if (!state?.profile_name || !hasPoints(state.probed_matrix)) return null
  return {
    name: state.profile_name,
    points: state.probed_matrix,
    min: state.mesh_min,
    max: state.mesh_max,
    active: true
  }
}

/** A saved profile's probed points. */
export const profileMesh = (state: Klipper.BedMeshState | undefined, name: string): Mesh | null => {
  const profile = state?.profiles?.[name]
  if (!profile || !hasPoints(profile.points)) return null
  const { min_x, min_y, max_x, max_y } = profile.mesh_params
  return {
    name,
    points: profile.points,
    min: [min_x, min_y],
    max: [max_x, max_y],
    active: state?.profile_name === name && activeMesh(state) != null
  }
}

export interface MeshStats {
  min: number
  max: number
  range: number
}

export const meshStats = (points: number[][]): MeshStats => {
  let min = Infinity
  let max = -Infinity
  for (const row of points) {
    for (const value of row) {
      if (value < min) min = value
      if (value > max) max = value
    }
  }
  if (!Number.isFinite(min)) return { min: 0, max: 0, range: 0 }
  return { min, max, range: max - min }
}

/** `count` evenly spaced coordinates from `min` to `max`. */
export const axisValues = (min: number, max: number, count: number): number[] => (
  count <= 1 ? [min] : Array.from({ length: count }, (_, i) => min + ((max - min) * i) / (count - 1))
)

/**
 * The colour scale's half-width. Floored so a nearly flat bed doesn't
 * saturate: 0.02 mm of variation shouldn't look like a disaster.
 */
export const MIN_SCALE_MM = 0.1

export const colourScale = (stats: MeshStats): number => (
  Math.max(Math.abs(stats.min), Math.abs(stats.max), MIN_SCALE_MM)
)

/** A value's position on the diverging scale, -1 (low) … 0 … 1 (high). */
export const scalePosition = (value: number, scale: number): number => (
  Math.max(-1, Math.min(1, value / scale))
)
