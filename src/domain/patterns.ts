import type { Bar, PatternKind } from '../../shared/types'

export type FoundPattern = { index: number; kind: PatternKind }

const LOOKBACK = 4
const MOVE = 0.03
const DOJI_BODY = 0.05
const SMALL_BODY = 1 / 3
const SHADOW = 2

type Shape = { body: number; range: number; upper: number; lower: number; rising: boolean }

const shapeOf = (bar: Bar): Shape => ({
  body: Math.abs(bar.close - bar.open),
  range: bar.high - bar.low,
  upper: bar.high - Math.max(bar.open, bar.close),
  lower: Math.min(bar.open, bar.close) - bar.low,
  rising: bar.close > bar.open,
})

const moveBefore = (bars: Bar[], index: number): number => {
  const last = bars[index - 1].close
  const first = bars[index - 1 - LOOKBACK].close
  return first > 0 ? (last - first) / first : 0
}

const kindAt = (bars: Bar[], index: number): PatternKind | null => {
  const move = moveBefore(bars, index)
  const fell = move <= -MOVE
  const rose = move >= MOVE
  if (!fell && !rose) return null
  const bar = bars[index]
  const previous = bars[index - 1]
  const now = shapeOf(bar)
  const before = shapeOf(previous)
  if (now.range <= 0) return null
  const engulfs = Math.min(bar.open, bar.close) <= Math.min(previous.open, previous.close) && Math.max(bar.open, bar.close) >= Math.max(previous.open, previous.close)
  if (fell && now.rising && !before.rising && before.body > 0 && engulfs) return 'bullishEngulfing'
  if (rose && !now.rising && before.rising && before.body > 0 && engulfs) return 'bearishEngulfing'
  const small = now.body <= now.range * SMALL_BODY
  if (fell && small && now.lower >= SHADOW * now.body && now.upper <= now.body) return 'hammer'
  if (rose && small && now.upper >= SHADOW * now.body && now.lower <= now.body) return 'shootingStar'
  return now.body <= now.range * DOJI_BODY ? 'doji' : null
}

export const findPatterns = (bars: Bar[], kinds: PatternKind[]): FoundPattern[] =>
  bars.flatMap((_, index): FoundPattern[] => {
    if (index < LOOKBACK + 1) return []
    const kind = kindAt(bars, index)
    return kind && kinds.includes(kind) ? [{ index, kind }] : []
  })
