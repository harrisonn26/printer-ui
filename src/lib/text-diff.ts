import { diffLines } from 'diff'

export type DiffRow =
  | { type: 'same' | 'add' | 'del', text: string }
  | { type: 'skip', count: number }

export interface DiffSummary {
  rows: DiffRow[]
  added: number
  removed: number
}

const splitLines = (text: string): string[] => {
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

/**
 * Line diff from `before` to `after`, keeping `context` unchanged lines
 * around each change and collapsing the rest into skip rows.
 */
export const diffText = (before: string, after: string, context = 3): DiffSummary => {
  const full: DiffRow[] = []
  let added = 0
  let removed = 0
  for (const part of diffLines(before, after)) {
    const type = part.added ? 'add' : part.removed ? 'del' : 'same'
    for (const text of splitLines(part.value)) full.push({ type, text })
    if (part.added) added += part.count ?? 0
    if (part.removed) removed += part.count ?? 0
  }

  const keep = full.map(row => row.type !== 'same')
  full.forEach((row, index) => {
    if (row.type === 'same') return
    for (let offset = -context; offset <= context; offset++) {
      if (index + offset >= 0 && index + offset < full.length) keep[index + offset] = true
    }
  })

  const rows: DiffRow[] = []
  let skipped = 0
  full.forEach((row, index) => {
    if (keep[index]) {
      if (skipped) rows.push({ type: 'skip', count: skipped })
      skipped = 0
      rows.push(row)
    } else {
      skipped++
    }
  })
  if (skipped) rows.push({ type: 'skip', count: skipped })
  return { rows, added, removed }
}
