import { activeMesh, axisValues, colourScale, meshStats, profileMesh, scalePosition } from '../mesh'

const params = {
  min_x: 10, max_x: 203, min_y: 10, max_y: 207,
  x_count: 3, y_count: 2, mesh_x_pps: 2, mesh_y_pps: 2, algo: 'bicubic', tension: 0.2
}

const state = (overrides: Partial<Klipper.BedMeshState> = {}): Klipper.BedMeshState => ({
  profile_name: '',
  mesh_min: [0, 0],
  mesh_max: [0, 0],
  probed_matrix: [[]],
  mesh_matrix: [[]],
  profiles: { default: { points: [[-0.1, 0, 0.05], [0.02, 0.1, -0.04]], mesh_params: params } },
  ...overrides
})

describe('activeMesh', () => {
  it('is null when nothing is loaded', () => {
    expect(activeMesh(state())).toBeNull()
    expect(activeMesh(undefined)).toBeNull()
  })

  it('uses the probed matrix of the loaded profile', () => {
    const mesh = activeMesh(state({
      profile_name: 'default',
      probed_matrix: [[1, 2], [3, 4]],
      mesh_min: [10, 10],
      mesh_max: [200, 200]
    }))
    expect(mesh).toEqual({ name: 'default', points: [[1, 2], [3, 4]], min: [10, 10], max: [200, 200], active: true })
  })
})

describe('profileMesh', () => {
  it('reads a saved profile, not active unless loaded', () => {
    const mesh = profileMesh(state(), 'default')
    expect(mesh?.min).toEqual([10, 10])
    expect(mesh?.max).toEqual([203, 207])
    expect(mesh?.active).toBe(false)
  })

  it('is active when the same profile is loaded', () => {
    const loaded = state({ profile_name: 'default', probed_matrix: [[0, 0]] })
    expect(profileMesh(loaded, 'default')?.active).toBe(true)
  })

  it('is null for a missing profile', () => {
    expect(profileMesh(state(), 'nope')).toBeNull()
  })
})

describe('meshStats', () => {
  it('finds min, max and range', () => {
    expect(meshStats([[-0.1, 0, 0.05], [0.02, 0.1, -0.04]])).toEqual({ min: -0.1, max: 0.1, range: 0.2 })
  })

  it('handles an empty mesh', () => {
    expect(meshStats([[]])).toEqual({ min: 0, max: 0, range: 0 })
  })
})

describe('axisValues', () => {
  it('spaces coordinates evenly, ends included', () => {
    expect(axisValues(10, 210, 5)).toEqual([10, 60, 110, 160, 210])
    expect(axisValues(10, 210, 1)).toEqual([10])
  })
})

describe('colour scale', () => {
  it('is symmetric around zero with a floor', () => {
    expect(colourScale({ min: -0.3, max: 0.1, range: 0.4 })).toBe(0.3)
    expect(colourScale({ min: -0.01, max: 0.02, range: 0.03 })).toBe(0.1)
  })

  it('clamps positions to -1…1', () => {
    expect(scalePosition(0.05, 0.1)).toBe(0.5)
    expect(scalePosition(-0.5, 0.1)).toBe(-1)
  })
})
