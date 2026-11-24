import { expect, test } from 'vitest'
import { addWeekdays, mondayOf } from '../../shared/dates'
import { createTimeIndex } from './timeIndex'
import { initialRange, rangeAfterTimeframeChange } from './visibleRange'

const dailyTimes = Array.from({ length: 1000 }, (_, i) => addWeekdays('2023-01-02', i))
const weeklyTimes = [...new Set(dailyTimes.map(mondayOf))]
const daily = { count: dailyTimes.length, timeIndex: createTimeIndex(dailyTimes, 'D') }
const weekly = { count: weeklyTimes.length, timeIndex: createTimeIndex(weeklyTimes, 'W') }

test('Should show the last 150 bars with a right margin for a new symbol', () => {
  expect(initialRange(1000)).toEqual({ from: 849.5, to: 1009.5 })
})

test('Should start at the first bar when the history is short', () => {
  expect(initialRange(20)).toEqual({ from: -0.5, to: 29.5 })
})

test('Should keep the bar count and the right margin when the view sits at the latest bar', () => {
  const next = rangeAfterTimeframeChange({ ...daily, range: { from: 849.5, to: 1009.5 } }, weekly)
  expect(weekly.count).toBe(200)
  expect(next).toEqual({ from: 49.5, to: 209.5 })
})

test('Should keep the bar count and the right-edge date when the view is scrolled back', () => {
  const next = rangeAfterTimeframeChange({ ...daily, range: { from: 300, to: 500 } }, weekly)
  expect(dailyTimes[500]).toBe('2024-12-02')
  expect(next).toEqual({ from: -100, to: 100 })
  expect(weeklyTimes[100]).toBe('2024-12-02')
})

test('Should land on the same date going back from weekly to daily', () => {
  const next = rangeAfterTimeframeChange({ ...weekly, range: { from: 40, to: 100 } }, daily)
  expect(next).toEqual({ from: 440, to: 500 })
})
