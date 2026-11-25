import { expect, test } from 'vitest'
import { addWeekdays } from '../../shared/dates'
import type { Bar, Earnings } from '../../shared/types'
import { dividendsAsOf, earningsAsOf, replayBars, startOfReplay, stepReplay } from './replay'

const days = Array.from({ length: 60 }, (_, index) => addWeekdays('2026-06-01', index))
const bars: Bar[] = days.map((time, index) => ({ time, open: 100 + index, high: 101 + index, low: 99 + index, close: 100 + index, volume: 1000 }))

test('Should keep only the bars up to the replay date', () => {
  expect(replayBars(bars, '2026-06-05').map((bar) => bar.time)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'])
})

test('Should start a replay at the end of the bar picked, a day, a week or a month', () => {
  expect(startOfReplay(bars, 'D', '2026-06-10')).toBe('2026-06-10')
  expect(startOfReplay(bars, 'W', '2026-06-08')).toBe('2026-06-12')
  expect(startOfReplay(bars, 'M', '2026-06-01')).toBe('2026-06-30')
})

test('Should not start a replay on the last bar or outside the history', () => {
  expect(startOfReplay(bars, 'D', days.at(-1) as string)).toBeNull()
  expect(startOfReplay(bars, 'D', '2020-01-01')).toBeNull()
})

test('Should step a whole bar of the timeframe on screen and stop at the end', () => {
  expect(stepReplay(bars, 'D', '2026-06-10')).toBe('2026-06-11')
  expect(stepReplay(bars, 'W', '2026-06-12')).toBe('2026-06-19')
  expect(stepReplay(bars, 'M', '2026-06-30')).toBe('2026-07-31')
  expect(stepReplay(bars, 'D', days.at(-1) as string)).toBeNull()
  expect(stepReplay(bars, 'M', '2026-07-31')).toBe(days.at(-1))
})

test('Should hide the earnings that had not happened yet on the replay date', () => {
  const earnings: Earnings = { past: ['2026-05-01', '2026-07-30'], next: '2026-10-29', nextIsEstimate: false }
  expect(earningsAsOf(earnings, '2026-06-15')).toEqual({ past: ['2026-05-01'], next: null, nextIsEstimate: false })
  expect(earningsAsOf(earnings, null)).toBe(earnings)
})

test('Should hide the dividends paid after the replay date', () => {
  const dividends = [
    { date: '2026-05-08', amount: 0.26 },
    { date: '2026-08-11', amount: 0.26 },
  ]
  expect(dividendsAsOf(dividends, '2026-06-15')).toEqual([{ date: '2026-05-08', amount: 0.26 }])
  expect(dividendsAsOf(dividends, null)).toBe(dividends)
})
