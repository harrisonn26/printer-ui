import { screwPosition, screwTurn, turnFraction, wedgePath } from '../screws'

describe('screwTurn', () => {
  it.each([
    ['CW', '00:13', '¼ turn CW'],
    ['CCW', '00:10', '⅛ turn CCW'],
    ['CCW', '00:02', '< ⅛ turn CCW'],
    ['CW', '00:30', '½ turn CW'],
    ['CW', '01:00', '1 turn CW'],
    ['CCW', '01:15', '1¼ turns CCW'],
    ['CW', '00:58', '1 turn CW'],
    ['CW', '00:00', 'No turn'],
    ['CW', 'bad', null]
  ])('%s %s → %s', (sign, adjust, expected) => {
    expect(screwTurn(sign, adjust)).toBe(expected)
  })
})

describe('turnFraction', () => {
  it('reads a clock face as turns', () => {
    expect(turnFraction('00:15')).toBe(0.25)
    expect(turnFraction('01:30')).toBe(1.5)
    expect(turnFraction('x')).toBeNull()
  })
})

describe('screwPosition', () => {
  it.each([
    [[30, 40.5], [30, 40.5]],
    ['30, 40.5', [30, 40.5]],
    ['30', null],
    [null, null],
    ['a, b', null]
  ])('%j → %j', (value, expected) => {
    expect(screwPosition(value)).toEqual(expected)
  })
})

describe('wedgePath', () => {
  it('sweeps a quarter clockwise to 3 o\'clock', () => {
    expect(wedgePath(0.25, true)).toBe('M 0 0 L 0 -1 A 1 1 0 0 1 1 0 Z')
  })
  it('sweeps a quarter counter-clockwise to 9 o\'clock', () => {
    expect(wedgePath(0.25, false)).toBe('M 0 0 L 0 -1 A 1 1 0 0 0 -1 0 Z')
  })
  it('uses the large arc past half', () => {
    expect(wedgePath(0.75, true)).toContain('A 1 1 0 1 1')
  })
  it('draws a full circle at a turn or more', () => {
    expect(wedgePath(1.5, true)).not.toContain('L')
  })
})
