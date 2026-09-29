import { dirOf, formatAgo, formatBytes, httpBase, pickThumbnail, thumbnailUrl } from '../files'

const thumb = (width: number, relative_path = `.thumbs/a-${width}x${width}.png`) => ({
  width,
  height: width,
  size: 1000,
  relative_path
})

describe('httpBase', () => {
  it('maps the websocket URL to its HTTP origin', () => {
    expect(httpBase('ws://192.168.0.140:7125/websocket')).toBe('http://192.168.0.140:7125')
    expect(httpBase('wss://printer.example/websocket')).toBe('https://printer.example')
  })
})

describe('dirOf', () => {
  it.each([['a.gcode', ''], ['sub/dir/a.gcode', 'sub/dir/']])('%s → %j', (path, expected) => {
    expect(dirOf(path)).toBe(expected)
  })
})

describe('pickThumbnail', () => {
  it('picks the smallest thumbnail at least as wide as asked', () => {
    expect(pickThumbnail([thumb(300), thumb(32), thumb(96)], 64)?.width).toBe(96)
  })

  it('falls back to the largest', () => {
    expect(pickThumbnail([thumb(32), thumb(48)], 64)?.width).toBe(48)
  })

  it('handles none', () => {
    expect(pickThumbnail(undefined, 64)).toBeUndefined()
    expect(pickThumbnail([], 64)).toBeUndefined()
  })
})

describe('thumbnailUrl', () => {
  it('resolves relative to the file folder and encodes each segment', () => {
    expect(thumbnailUrl('ws://printer:7125/websocket', 'my prints/Benchy #2.gcode', thumb(300, '.thumbs/Benchy #2-300x300.png')))
      .toBe('http://printer:7125/server/files/gcodes/my%20prints/.thumbs/Benchy%20%232-300x300.png')
  })
})

describe('formatBytes', () => {
  it.each([[512, '512 B'], [2048, '2.0 KB'], [17_248_388, '16 MB'], [3 * 1024 ** 3, '3.0 GB']])('%d → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})

describe('formatAgo', () => {
  const now = Date.UTC(2026, 8, 29, 12)
  it('uses relative time within a week', () => {
    expect(formatAgo(now / 1000 - 30, now)).toMatch(/now/)
    expect(formatAgo(now / 1000 - 5 * 60, now)).toMatch(/5 min/)
    expect(formatAgo(now / 1000 - 86_400, now)).toMatch(/yesterday/)
  })

  it('shows a date past a week', () => {
    expect(formatAgo(now / 1000 - 30 * 86_400, now)).not.toMatch(/ago/)
  })
})
