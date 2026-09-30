import {
  isMeshComplete,
  meshGridFromSettings,
  parseProbeLine,
  probeOffsetsFromSettings,
  probeProgress
} from '../mesh-probe'

describe('parseProbeLine', () => {
  it('reads the current Klipper format, already in mesh coordinates', () => {
    expect(parseProbeLine('// probe: at 92.500,205.000 bed will contact at z=-0.078750'))
      .toEqual({ x: 92.5, y: 205, z: -0.07875, adjusted: true })
  })

  it('reads the older format, at the toolhead', () => {
    expect(parseProbeLine('// probe at 34.000,24.500 is z=1.610833')).toEqual({ x: 34, y: 24.5, z: 1.610833, adjusted: false })
  })

  it('ignores everything else', () => {
    expect(parseProbeLine('// Mesh Bed Leveling Complete')).toBeNull()
    expect(parseProbeLine('// probe: open')).toBeNull()
  })
})

describe('isMeshComplete', () => {
  it('spots the end of a calibration', () => {
    expect(isMeshComplete('// Mesh Bed Leveling Complete')).toBe(true)
    expect(isMeshComplete('// probe: at 1,2 bed will contact at z=0')).toBe(false)
  })
})

describe('settings', () => {
  it('reads the grid from [bed_mesh]', () => {
    expect(meshGridFromSettings({ mesh_min: [10, 10], mesh_max: [175, 205], probe_count: [5, 5] }))
      .toEqual({ min: [10, 10], max: [175, 205], count: [5, 5] })
    expect(meshGridFromSettings({ mesh_min: [0, 0], mesh_max: [100, 100], probe_count: 3 })?.count).toEqual([3, 3])
    expect(meshGridFromSettings({ mesh_radius: 100 })).toBeNull()
  })

  it('reads probe offsets from whichever probe section exists', () => {
    expect(probeOffsetsFromSettings({ bltouch: { x_offset: -42, y_offset: -10, z_offset: 1.125 } }))
      .toEqual({ x: -42, y: -10, z: 1.125 })
    expect(probeOffsetsFromSettings({})).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('probeProgress', () => {
  describe('current format (the Ender 5)', () => {
    const grid = { min: [10, 10] as [number, number], max: [175, 205] as [number, number], count: [5, 5] as [number, number] }
    const offsets = { x: -42, y: -10, z: 1.125 }
    const lines = [
      '// probe: at 92.500,205.000 bed will contact at z=-0.078750',
      '// probe: at 133.750,205.000 bed will contact at z=-0.008750',
      '// probe: at 175.000,205.000 bed will contact at z=0.020000'
    ]

    it('places values as reported, without applying probe offsets', () => {
      const samples = lines.map(line => parseProbeLine(line)!)
      const progress = probeProgress(samples, grid, offsets)
      expect(progress.values[4]).toEqual([null, null, -0.07875, -0.00875, 0.02])
      expect(progress).toMatchObject({ done: 3, total: 25, current: [4, 4], offGrid: 0 })
    })
  })

  describe('older format', () => {
    const grid = { min: [10, 10] as [number, number], max: [210, 110] as [number, number], count: [3, 2] as [number, number] }
    const offsets = { x: -24, y: -14.5, z: 1.7 }
    // Reported at the toolhead, which is the point minus the probe offset.
    const at = (px: number, py: number, z: number) => ({ x: px - offsets.x, y: py - offsets.y, z, adjusted: false })

    it('shifts by the probe offset and subtracts its z_offset', () => {
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
})
