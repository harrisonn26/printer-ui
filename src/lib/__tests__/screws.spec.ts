import { screwTurn } from '../screws'

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
