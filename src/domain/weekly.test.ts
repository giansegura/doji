import { expect, test } from 'vitest'
import type { Bar } from '../../shared/types'
import { toWeekly } from './weekly'

const bar = (time: string, open: number, high: number, low: number, close: number, volume: number): Bar => ({
  time,
  open,
  high,
  low,
  close,
  volume,
})

test('Should group daily bars into weeks labelled by their first session', () => {
  const daily = [
    bar('2026-11-19', 10, 12, 9, 11, 100),
    bar('2026-11-20', 11, 15, 10, 14, 200),
    bar('2026-11-24', 14, 16, 13, 15, 300),
    bar('2026-11-27', 15, 15.5, 12, 12.5, 50),
  ]
  expect(toWeekly(daily)).toEqual([
    bar('2026-11-19', 10, 15, 9, 14, 300),
    bar('2026-11-24', 14, 16, 12, 12.5, 350),
  ])
})

test('Should split weeks across a year boundary', () => {
  const daily = [bar('2026-12-28', 1, 2, 1, 2, 1), bar('2026-12-31', 2, 3, 2, 3, 1), bar('2027-01-04', 3, 4, 3, 4, 1)]
  expect(toWeekly(daily).map((b) => b.time)).toEqual(['2026-12-28', '2027-01-04'])
})

test('Should return an empty list for no bars', () => {
  expect(toWeekly([])).toEqual([])
})
