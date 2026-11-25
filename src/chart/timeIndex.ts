import {
  addDays,
  addMonths,
  addWeekdays,
  daysBetween,
  mondayOf,
  monthStartOf,
  monthsBetween,
  weekdaysBetween,
  weeksBetween,
} from '../../shared/dates'
import type { Timeframe } from '../../shared/types'
import { addUsMarketDays, followsUsMarket, usMarketDaysBetween } from '../domain/marketCalendar'

export type TimeIndex = {
  dateToIndex: (date: string) => number
  indexToDate: (index: number) => string
}

type Steps = {
  between: (from: string, to: string) => number
  shift: (from: string, steps: number) => string
}

type Period = Steps & { keyOf: (date: string) => string }

const PERIODS: Record<Timeframe, Period> = {
  D: { keyOf: (date) => date, between: weekdaysBetween, shift: addWeekdays },
  W: { keyOf: mondayOf, between: weeksBetween, shift: (from, steps) => addDays(mondayOf(from), steps * 7) },
  M: { keyOf: monthStartOf, between: monthsBetween, shift: addMonths },
}

const US_MARKET_DAYS: Steps = { between: usMarketDaysBetween, shift: addUsMarketDays }

const EVERY_DAY: Steps = { between: daysBetween, shift: addDays }

const isWeekend = (date: string): boolean => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())

const lowerBound = (sorted: string[], target: string): number => {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (sorted[middle] < target) low = middle + 1
    else high = middle
  }
  return low
}

export const createTimeIndex = (times: string[], timeframe: Timeframe): TimeIndex => {
  const period = PERIODS[timeframe]
  const lastIndex = times.length - 1
  const first = times[0]
  const last = times[lastIndex]
  const keys = times.map(period.keyOf)
  const everyDay = timeframe === 'D' && times.some(isWeekend)
  const ahead = everyDay ? EVERY_DAY : timeframe === 'D' && followsUsMarket(times) ? US_MARKET_DAYS : period
  const behind = everyDay ? EVERY_DAY : period

  const dateToIndex = (date: string): number => {
    const key = period.keyOf(date)
    if (key > keys[lastIndex]) return lastIndex + ahead.between(last, date)
    if (key < keys[0]) return behind.between(first, date)
    return lowerBound(keys, key)
  }

  const indexToDate = (index: number): string => {
    if (index > lastIndex) return ahead.shift(last, index - lastIndex)
    if (index < 0) return behind.shift(first, index)
    return times[index]
  }

  return { dateToIndex, indexToDate }
}
