import { diffText } from '../text-diff'

const lines = (count: number, prefix = 'line') => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`)

describe('diffText', () => {
  it('reports a changed line with context and collapses the rest', () => {
    const before = lines(20).join('\n') + '\n'
    const afterLines = lines(20)
    afterLines[9] = 'changed'
    const result = diffText(before, afterLines.join('\n') + '\n', 2)

    expect(result).toMatchObject({ added: 1, removed: 1 })
    expect(result.rows).toEqual([
      { type: 'skip', count: 7 },
      { type: 'same', text: 'line 8' },
      { type: 'same', text: 'line 9' },
      { type: 'del', text: 'line 10' },
      { type: 'add', text: 'changed' },
      { type: 'same', text: 'line 11' },
      { type: 'same', text: 'line 12' },
      { type: 'skip', count: 8 }
    ])
  })

  it('is empty for identical text', () => {
    expect(diffText('a\nb\n', 'a\nb\n')).toEqual({ rows: [{ type: 'skip', count: 2 }], added: 0, removed: 0 })
  })

  it('handles a missing trailing newline', () => {
    expect(diffText('a\nb', 'a\nc').added).toBe(1)
  })
})
