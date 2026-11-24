import type { Split, TrendLine } from '../../shared/types'

const NO_SPLITS = '0000-01-01'

const latestDate = (splits: Split[]): string =>
  splits.reduce((latest, split) => (split.date > latest ? split.date : latest), NO_SPLITS)

export const splitBasis = (splits: Split[]): string => latestDate(splits)

export const adjustLinesForSplits = (lines: TrendLine[], splits: Split[]): { lines: TrendLine[]; changed: boolean } => {
  let changed = false
  const adjusted = lines.map((line) => {
    if (line.pane !== 'price') return line
    const pending = splits.filter((split) => split.date > line.pricedAt)
    if (pending.length === 0) return line
    const factor = pending.reduce((product, split) => (product * split.denominator) / split.numerator, 1)
    changed = true
    return {
      ...line,
      p1: { ...line.p1, value: line.p1.value * factor },
      p2: { ...line.p2, value: line.p2.value * factor },
      pricedAt: latestDate(pending),
    }
  })
  return { lines: adjusted, changed }
}
