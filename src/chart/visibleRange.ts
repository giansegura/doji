import type { TimeIndex } from './timeIndex'

export type VisibleRange = { from: number; to: number }

type View = { count: number; timeIndex: TimeIndex }

const VISIBLE_BARS = 150
const RIGHT_MARGIN_BARS = 10

export const initialRange = (count: number): VisibleRange => ({
  from: Math.max(count - VISIBLE_BARS, 0) - 0.5,
  to: count - 1 + RIGHT_MARGIN_BARS + 0.5,
})

export const rangeAfterTimeframeChange = (previous: View & { range: VisibleRange }, next: View): VisibleRange => {
  const width = previous.range.to - previous.range.from
  const overshoot = previous.range.to - (previous.count - 1)
  if (overshoot >= 0) {
    const to = next.count - 1 + overshoot
    return { from: to - width, to }
  }
  const anchor = Math.round(previous.range.to)
  const to = next.timeIndex.dateToIndex(previous.timeIndex.indexToDate(anchor)) + (previous.range.to - anchor)
  return { from: to - width, to }
}
