import type { Drawing, LinePoint, Split } from '../../shared/types'

const NO_SPLITS = '0000-01-01'

const latestDate = (splits: Split[]): string =>
  splits.reduce((latest, split) => (split.date > latest ? split.date : latest), NO_SPLITS)

const scaled = (point: LinePoint, factor: number): LinePoint => ({ ...point, value: point.value * factor })

const rescale = (drawing: Drawing, factor: number): Drawing => {
  if (drawing.kind === 'hline') return { ...drawing, value: drawing.value * factor }
  if (drawing.kind === 'channel') {
    return {
      ...drawing,
      p1: scaled(drawing.p1, factor),
      p2: scaled(drawing.p2, factor),
      offset: drawing.offset * factor,
    }
  }
  return { ...drawing, p1: scaled(drawing.p1, factor), p2: scaled(drawing.p2, factor) }
}

export const splitBasis = (splits: Split[]): string => latestDate(splits)

export const adjustLinesForSplits = <T extends Drawing>(lines: T[], splits: Split[]): { lines: T[]; changed: boolean } => {
  let changed = false
  const adjusted = lines.map((line) => {
    if (line.pane !== 'price') return line
    const pending = splits.filter((split) => split.date > line.pricedAt)
    if (pending.length === 0) return line
    const factor = pending.reduce((product, split) => (product * split.denominator) / split.numerator, 1)
    changed = true
    return { ...rescale(line, factor), pricedAt: latestDate(pending) } as T
  })
  return { lines: adjusted, changed }
}
