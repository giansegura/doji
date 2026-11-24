import type { Timeframe } from '../../shared/types'
import { addDays, addWeekdays, mondayOf, weekdaysBetween, weeksBetween } from '../../shared/dates'
import { addUsMarketDays, followsUsMarket, usMarketDaysBetween } from '../domain/marketCalendar'

export type TimeIndex = {
  dateToIndex: (date: string) => number
  indexToDate: (index: number) => string
}

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
  const isWeekly = timeframe === 'W'
  const lastIndex = times.length - 1
  const first = times[0]
  const last = times[lastIndex]
  const keys = isWeekly ? times.map(mondayOf) : times
  const keyOf = (date: string): string => (isWeekly ? mondayOf(date) : date)
  const restsOnHolidays = !isWeekly && followsUsMarket(times)
  const stepsBetween = isWeekly ? weeksBetween : weekdaysBetween
  const stepsAhead = restsOnHolidays ? usMarketDaysBetween : stepsBetween
  const sessionAhead = restsOnHolidays ? addUsMarketDays : addWeekdays

  const dateToIndex = (date: string): number => {
    const key = keyOf(date)
    if (key > keys[lastIndex]) return lastIndex + stepsAhead(last, date)
    if (key < keys[0]) return stepsBetween(first, date)
    return lowerBound(keys, key)
  }

  const indexToDate = (index: number): string => {
    if (index > lastIndex) {
      return isWeekly ? addDays(mondayOf(last), (index - lastIndex) * 7) : sessionAhead(last, index - lastIndex)
    }
    if (index < 0) return isWeekly ? addDays(mondayOf(first), index * 7) : addWeekdays(first, index)
    return times[index]
  }

  return { dateToIndex, indexToDate }
}
