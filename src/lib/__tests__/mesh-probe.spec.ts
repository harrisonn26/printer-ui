import { meshGridFromSettings, parseProbeLine, probeOffsetsFromSettings, probeProgress } from '../mesh-probe'

describe('parseProbeLine', () => {
  it('reads Klipper probe results', () => {
    expect(parseProbeLine('// probe at 34.000,24.500 is z=1.610833')).toEqual({ x: 34, y: 24.5, z: 1.610833 })
    expect(parseProbeLine('probe at -5.000,10.000 is z=-0.02')).toEqual({ x: -5, y: 10, z: -0.02 })
  })

  it('ignores everything else', () => {
    expect(parseProbeLine('// Mesh Bed Leveling Complete')).toBeNull()
  })
})

describe('settings', () => {
  it('reads the grid from [bed_mesh]', () => {
    expect(meshGridFromSettings({ mesh_min: [10, 10], mesh_max: [203, 207], probe_count: [5, 5] }))
      .toEqual({ min: [10, 10], max: [203, 207], count: [5, 5] })
    expect(meshGridFromSettings({ mesh_min: [0, 0], mesh_max: [100, 100], probe_count: 3 })?.count).toEqual([3, 3])
    expect(meshGridFromSettings({ mesh_radius: 100 })).toBeNull()
  })

  it('reads probe offsets from whichever probe section exists', () => {
    expect(probeOffsetsFromSettings({ bltouch: { x_offset: -24, y_offset: -14.5, z_offset: 1.701 } }))
      .toEqual({ x: -24, y: -14.5, z: 1.701 })
    expect(probeOffsetsFromSettings({})).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('probeProgress', () => {
  const grid = { min: [10, 10] as [number, number], max: [210, 110] as [number, number], count: [3, 2] as [number, number] }
  const offsets = { x: -24, y: -14.5, z: 1.7 }
  // Reported at the toolhead, which is the point minus the probe offset.
  const at = (px: number, py: number, z: number) => ({ x: px - offsets.x, y: py - offsets.y, z })

  it('places samples on grid points and subtracts the probe z_offset', () => {
    const progress = probeProgress([at(10, 10, 1.6), at(110, 10, 1.8)], grid, offsets)
    expect(progress.values[0]![0]).toBeCloseTo(-0.1)
    expect(progress.values[0]![1]).toBeCloseTo(0.1)
    expect(progress.values[1]).toEqual([null, null, null])
    expect(progress).toMatchObject({ done: 2, total: 6, current: [1, 0], offGrid: 0 })
  })

  it('counts a point once however many samples it takes', () => {
    const progress = probeProgress([at(210, 110, 1.7), at(210, 110, 1.71), at(210, 110, 1.72)], grid, offsets)
    expect(progress.done).toBe(1)
    expect(progress.values[1]![2]).toBeCloseTo(0.02)
  })

  it('sets aside samples that miss the grid', () => {
    expect(probeProgress([at(60, 60, 1.7)], grid, offsets).offGrid).toBe(1)
  })
})
