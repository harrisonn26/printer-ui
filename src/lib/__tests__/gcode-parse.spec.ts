import { lastAtOrBefore, layerRange, parseGcode } from '../gcode-parse'

const gcode = (lines: string[]) => lines.join('\n') + '\n'

describe('parseGcode', () => {
  it('records extruding moves with their byte offsets, grouped by layer Z', () => {
    const text = gcode([
      'G90',
      'M83',
      'G1 Z0.2 F600',
      'G1 X10 Y0 E1',
      'G1 X10 Y10 E1 ; comment',
      'G0 Z0.6',
      'G1 X20 Y20',
      'G1 Z0.4',
      'G1 X20 Y30 E1'
    ])
    const parsed = parseGcode(text)

    expect(Array.from(parsed.layerZ)).toEqual([expect.closeTo(0.2), expect.closeTo(0.4)])
    expect(Array.from(parsed.layerStart)).toEqual([0, 2])
    expect(Array.from(parsed.x1)).toEqual([10, 10, 20])
    expect(parsed.byte[0]).toBe(text.indexOf('G1 X10 Y0'))
    expect(parsed.byte[2]).toBe(text.indexOf('G1 X20 Y30'))
  })

  it('ignores travels, retractions and Z-hops for layers', () => {
    const parsed = parseGcode(gcode([
      'M83',
      'G1 Z0.2',
      'G1 X5 Y5 E1',
      'G1 E-0.8',
      'G1 Z0.6',
      'G1 X50 Y50',
      'G1 Z0.2',
      'G1 E0.8',
      'G1 X55 Y50 E1'
    ]))

    expect(parsed.layerStart).toHaveLength(1)
    expect(parsed.x0).toHaveLength(2)
  })

  it('tracks absolute extrusion across G92 resets', () => {
    const parsed = parseGcode(gcode([
      'M82',
      'G1 X1 Y0 E1',
      'G92 E0',
      'G1 X2 Y0 E0.5',
      'G1 X3 Y0 E0.5'
    ]))

    expect(parsed.x0).toHaveLength(2)
  })

  it('linearises arcs, ending exactly on the target', () => {
    // Quarter circle, counter-clockwise, centre (0,0), radius 10.
    const parsed = parseGcode(gcode(['M83', 'G1 X10 Y0', 'G3 X0 Y10 I-10 J0 E1']))
    const last = parsed.x1.length - 1

    expect(parsed.x1.length).toBeGreaterThan(4)
    expect(parsed.x1[last]).toBe(0)
    expect(parsed.y1[last]).toBe(10)
    for (let i = 0; i < parsed.x1.length; i++) {
      expect(Math.hypot(parsed.x1[i]!, parsed.y1[i]!)).toBeCloseTo(10, 3)
    }
  })

  it('draws clockwise arcs the short way round', () => {
    // Clockwise from (0,10) to (10,0) around the origin stays in +x,+y.
    const parsed = parseGcode(gcode(['M83', 'G1 X0 Y10', 'G2 X10 Y0 I0 J-10 E1']))
    for (let i = 0; i < parsed.x1.length; i++) {
      expect(parsed.x1[i]).toBeGreaterThanOrEqual(-1e-4)
      expect(parsed.y1[i]).toBeGreaterThanOrEqual(-1e-4)
    }
  })

  it('reports model bounds', () => {
    const parsed = parseGcode(gcode(['M83', 'G1 X5 Y5', 'G1 X25 Y15 E1']))
    expect([parsed.minX, parsed.minY, parsed.maxX, parsed.maxY]).toEqual([5, 5, 25, 15])
  })
})

describe('lastAtOrBefore', () => {
  it.each([[0, -1], [5, 0], [12, 1], [100, 2]])('%d → %d', (value, expected) => {
    expect(lastAtOrBefore([5, 10, 20], value)).toBe(expected)
  })
})

describe('layerRange', () => {
  it('spans to the next layer, or to the end', () => {
    const parsed = parseGcode(gcode(['M83', 'G1 Z0.2', 'G1 X1 Y0 E1', 'G1 X2 Y0 E1', 'G1 Z0.4', 'G1 X3 Y0 E1']))
    expect(layerRange(parsed, 0)).toEqual([0, 2])
    expect(layerRange(parsed, 1)).toEqual([2, 3])
  })
})

describe('slicer layer markers', () => {
  it('uses ;LAYER_CHANGE / ;Z: over Z changes, so spiral vase layers stay whole', () => {
    // Spiral: Z rises on every move within each layer.
    const parsed = parseGcode(gcode([
      'M83',
      ';LAYER_CHANGE',
      ';Z:0.2',
      'G1 X10 Y0 Z0.2 E1',
      'G1 X10 Y10 Z0.25 E1',
      'G1 X0 Y10 Z0.3 E1',
      ';LAYER_CHANGE',
      ';Z:0.4',
      'G1 X0 Y0 Z0.35 E1',
      'G1 X10 Y0 Z0.4 E1'
    ]))
    expect(Array.from(parsed.layerStart)).toEqual([0, 3])
    expect(Array.from(parsed.layerZ)).toEqual([expect.closeTo(0.2), expect.closeTo(0.4)])
  })

  it('leaves the start G-code purge line out of the layers and the framing', () => {
    const parsed = parseGcode(gcode([
      'M83',
      'G1 X3 Y20 Z0.28',
      'G1 Y120 E10',
      ';LAYER_CHANGE',
      ';Z:0.2',
      'G1 X50 Y50 Z0.2',
      'G1 X60 Y50 E1',
      'G1 X60 Y60 E1'
    ]))
    expect(Array.from(parsed.layerStart)).toEqual([1])
    expect([parsed.minX, parsed.minY, parsed.maxX, parsed.maxY]).toEqual([50, 50, 60, 60])
  })

  it('ignores markers with nothing printed after them', () => {
    const parsed = parseGcode(gcode(['M83', ';LAYER_CHANGE', ';Z:0.2', 'G1 X1 Y0 E1', ';LAYER_CHANGE', ';Z:0.4', 'G1 Z10']))
    expect(parsed.layerStart).toHaveLength(1)
  })

  it('reads Cura markers, taking Z from the first extrusion', () => {
    const parsed = parseGcode(gcode(['M83', ';LAYER:0', 'G1 X0 Y0 Z0.3', 'G1 X5 Y0 E1', ';LAYER:1', 'G1 Z0.5', 'G1 X5 Y5 E1']))
    expect(Array.from(parsed.layerZ)).toEqual([expect.closeTo(0.3), expect.closeTo(0.5)])
  })
})

describe('repeated layer markers', () => {
  it("folds a marker at the same Z into the previous layer (Orca's closing spiral pass)", () => {
    const parsed = parseGcode(gcode([
      'M83',
      ';LAYER_CHANGE', ';Z:31.56', 'G1 X1 Y0 Z31.56 E1',
      ';LAYER_CHANGE', ';Z:31.88', 'G1 X2 Y0 Z31.88 E1',
      ';LAYER_CHANGE', ';Z:31.88', 'G1 X3 Y0 Z31.88 E1'
    ]))
    expect(parsed.layerStart).toHaveLength(2)
  })
})
