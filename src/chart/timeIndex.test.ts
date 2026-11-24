import { expect, test } from 'vitest'
import { addDays } from '../../shared/dates'
import { usMarketHolidays } from '../domain/marketCalendar'
import { createTimeIndex } from './timeIndex'

const isWeekend = (date: string): boolean => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())

const weekdaysFrom = (from: string, to: string): string[] => {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) if (!isWeekend(day)) days.push(day)
  return days
}

const HOLIDAYS = new Set([2025, 2026].flatMap(usMarketHolidays))
const everyWeekday = weekdaysFrom('2025-01-02', '2026-11-23')
const usSessions = everyWeekday.filter((day) => !HOLIDAYS.has(day))

const daily = createTimeIndex(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23'], 'D')
const weekly = createTimeIndex(['2026-11-09', '2026-11-16', '2026-11-24'], 'W')

test('Should map a session date to its bar', () => {
  expect(daily.dateToIndex('2026-11-19')).toBe(1)
})

test('Should snap a weekend date to the next bar', () => {
  expect(daily.dateToIndex('2026-11-21')).toBe(3)
})

test('Should extrapolate dates after the last bar by weekdays', () => {
  expect(daily.dateToIndex('2026-11-25')).toBe(5)
  expect(daily.indexToDate(5)).toBe('2026-11-25')
})

test('Should extrapolate dates before the first bar', () => {
  expect(daily.dateToIndex('2026-11-17')).toBe(-1)
  expect(daily.indexToDate(-1)).toBe('2026-11-17')
})

test('Should map any day to the weekly bar of its week', () => {
  expect(weekly.dateToIndex('2026-11-20')).toBe(1)
  expect(weekly.dateToIndex('2026-11-23')).toBe(2)
})

test('Should extrapolate weekly dates after the last bar', () => {
  expect(weekly.dateToIndex('2026-12-09')).toBe(4)
  expect(weekly.indexToDate(4)).toBe('2026-12-07')
})

test('Should extrapolate weekly dates before the first bar', () => {
  expect(weekly.dateToIndex('2026-10-28')).toBe(-2)
  expect(weekly.indexToDate(-2)).toBe('2026-10-26')
})

test('Should snap a week without sessions to the next weekly bar', () => {
  const gapped = createTimeIndex(['2026-11-02', '2026-11-16'], 'W')
  expect(gapped.dateToIndex('2026-11-11')).toBe(1)
})

test('Should keep a point drawn on weekly inside the same week on daily', () => {
  const weeklyOfDaily = createTimeIndex(['2026-11-18', '2026-11-23'], 'W')
  expect(weeklyOfDaily.dateToIndex('2026-11-20')).toBe(0)
  expect(daily.dateToIndex(weeklyOfDaily.indexToDate(0))).toBe(0)
  expect(daily.dateToIndex(weeklyOfDaily.indexToDate(1))).toBe(3)
})

test('Should round-trip every in-range index', () => {
  const indexes = [0, 1, 2, 3]
  expect(indexes.map((i) => daily.dateToIndex(daily.indexToDate(i)))).toEqual(indexes)
  expect([0, 1, 2].map((i) => weekly.dateToIndex(weekly.indexToDate(i)))).toEqual([0, 1, 2])
})

test('Should skip market holidays ahead when the history rests on them', () => {
  const index = createTimeIndex(usSessions, 'D')
  const last = usSessions.length - 1
  expect(index.indexToDate(last + 2)).toBe('2026-11-25')
  expect(index.indexToDate(last + 3)).toBe('2026-11-27')
  expect(index.dateToIndex('2026-11-27')).toBe(last + 3)
  expect(index.dateToIndex('2026-12-28')).toBe(last + 23)
})

test('Should count every weekday ahead when the history trades on market holidays', () => {
  const index = createTimeIndex(everyWeekday, 'D')
  const last = everyWeekday.length - 1
  expect(index.indexToDate(last + 3)).toBe('2026-11-26')
  expect(index.dateToIndex('2026-11-27')).toBe(last + 4)
})

test('Should round-trip the indexes ahead of a history that rests on market holidays', () => {
  const index = createTimeIndex(usSessions, 'D')
  const ahead = Array.from({ length: 300 }, (_, step) => usSessions.length + step)
  expect(ahead.map((position) => index.dateToIndex(index.indexToDate(position)))).toEqual(ahead)
})

test('Should keep weekly bars ahead one week apart across holidays', () => {
  const index = createTimeIndex(['2026-11-09', '2026-11-16', '2026-11-23'], 'W')
  expect(index.indexToDate(3)).toBe('2026-11-30')
  expect(index.dateToIndex('2026-11-27')).toBe(2)
})
