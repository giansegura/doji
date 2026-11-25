import { type Turn, turnsOf } from '../../shared/levels'

export type Divergence = {
  kind: 'bullish' | 'bearish'
  from: number
  to: number
  priceFrom: number
  priceTo: number
  rsiFrom: number
  rsiTo: number
}

const MAX_APART = 80

const pairsOf = (turns: Turn[]): [Turn, Turn][] =>
  turns.slice(1).flatMap((turn, index): [Turn, Turn][] => {
    const before = turns[index]
    return turn.index - before.index <= MAX_APART ? [[before, turn]] : []
  })

export const findDivergences = (bars: { high: number; low: number }[], rsi: (number | null)[], reach: number): Divergence[] => {
  const turns = turnsOf(bars, reach)
  const lows = turns.filter((turn) => turn.kind === 'low')
  const highs = turns.filter((turn) => turn.kind === 'high')
  const found = (pairs: [Turn, Turn][], kind: Divergence['kind']): Divergence[] =>
    pairs.flatMap(([first, second]) => {
      const rsiFrom = rsi[first.index] ?? null
      const rsiTo = rsi[second.index] ?? null
      if (rsiFrom === null || rsiTo === null) return []
      const diverges = kind === 'bullish' ? second.price < first.price && rsiTo > rsiFrom : second.price > first.price && rsiTo < rsiFrom
      return diverges ? [{ kind, from: first.index, to: second.index, priceFrom: first.price, priceTo: second.price, rsiFrom, rsiTo }] : []
    })
  return [...found(pairsOf(lows), 'bullish'), ...found(pairsOf(highs), 'bearish')].sort((a, b) => a.to - b.to)
}
