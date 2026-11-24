import { expect, test } from 'vitest'
import type { Bar } from '../../shared/types'
import { toMonthly } from './monthly'

const bar = (time: string, open: number, high: number, low: number, close: number, volume: number): Bar => ({
  time,
  open,
  high,
  low,
  close,
  volume,
})

test('Should group daily bars into months labelled by their first session', () => {
  const out = toMonthly([
    bar('2026-10-29', 10, 12, 9, 11, 100),
    bar('2026-10-30', 11, 15, 10, 14, 200),
    bar('2026-11-02', 14, 16, 13, 15, 50),
    bar('2026-11-03', 15, 15.5, 8, 9, 70),
  ])
  expect(out).toEqual([bar('2026-10-29', 10, 15, 9, 14, 300), bar('2026-11-02', 14, 16, 8, 9, 120)])
})

test('Should split months across a year boundary', () => {
  const out = toMonthly([bar('2026-12-31', 1, 2, 1, 2, 1), bar('2027-01-04', 2, 3, 2, 3, 1)])
  expect(out.map((month) => month.time)).toEqual(['2026-12-31', '2027-01-04'])
})

test('Should return an empty list for no bars', () => {
  expect(toMonthly([])).toEqual([])
})

test('Should leave the daily bars untouched', () => {
  const daily = [bar('2026-11-02', 14, 16, 13, 15, 50), bar('2026-11-03', 15, 15.5, 8, 9, 70)]
  toMonthly(daily)
  expect(daily[0]).toEqual(bar('2026-11-02', 14, 16, 13, 15, 50))
})
