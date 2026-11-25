import type { VisibleRange } from './visibleRange'

export type RangeKey = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'All'

export const RANGE_KEYS: RangeKey[] = ['1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All']

const RIGHT_MARGIN_BARS = 10
const HALF_BAR = 0.5
const MONTHS: Partial<Record<RangeKey, number>> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '5Y': 60 }

const monthsBefore = (date: string, months: number): string => {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 - months, 1))
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate()
  shifted.setUTCDate(Math.min(day, lastDay))
  return shifted.toISOString().slice(0, 10)
}

const startOf = (key: RangeKey, today: string): string | null => {
  if (key === 'All') return null
  if (key === 'YTD') return `${today.slice(0, 4)}-01-01`
  return monthsBefore(today, MONTHS[key] ?? 0)
}

const firstFrom = (times: string[], date: string): number => {
  const index = times.findIndex((time) => time >= date)
  return index === -1 ? times.length - 1 : index
}

export const rangeOf = (key: RangeKey, times: string[], today: string): VisibleRange => {
  const start = startOf(key, today)
  const from = start === null ? 0 : firstFrom(times, start)
  return { from: from - HALF_BAR, to: times.length - 1 + RIGHT_MARGIN_BARS + HALF_BAR }
}

export const centerOn = (date: string, times: string[], width: number): VisibleRange | null => {
  if (times.length === 0) return null
  const index = firstFrom(times, date)
  return { from: index - width / 2, to: index + width / 2 }
}
