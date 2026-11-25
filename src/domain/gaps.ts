import type { Bar } from '../../shared/types'

export type OpenGap = { index: number; top: number; bottom: number; direction: 'up' | 'down' }

const PERCENT = 100

const narrowed = (gap: OpenGap, bar: Bar): OpenGap | null => {
  if (gap.direction === 'up') {
    if (bar.low <= gap.bottom) return null
    return bar.low < gap.top ? { ...gap, top: bar.low } : gap
  }
  if (bar.high >= gap.top) return null
  return bar.high > gap.bottom ? { ...gap, bottom: bar.high } : gap
}

const gapAt = (bars: Bar[], index: number, minPercent: number): OpenGap | null => {
  const bar = bars[index]
  const previous = bars[index - 1]
  if (bar.low > previous.high && ((bar.low - previous.high) / previous.high) * PERCENT >= minPercent) return { index, top: bar.low, bottom: previous.high, direction: 'up' }
  if (bar.high < previous.low && ((previous.low - bar.high) / previous.low) * PERCENT >= minPercent) return { index, top: previous.low, bottom: bar.high, direction: 'down' }
  return null
}

export const findOpenGaps = (bars: Bar[], minPercent: number): OpenGap[] =>
  bars.reduce<OpenGap[]>((open, bar, index) => {
    if (index === 0) return open
    const still = open.flatMap((gap) => {
      const left = narrowed(gap, bar)
      return left ? [left] : []
    })
    const fresh = gapAt(bars, index, minPercent)
    return fresh ? [...still, fresh] : still
  }, [])
