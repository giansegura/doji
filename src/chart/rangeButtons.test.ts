import { expect, test } from 'vitest'
import { centerOn, rangeOf } from './rangeButtons'

const times = ['2020-01-02', '2025-11-03', '2026-01-02', '2026-05-26', '2026-08-25', '2026-10-26', '2026-11-24']

test('Should show from the start of each span up to the last bar with the usual margin on the right', () => {
  expect(rangeOf('1M', times, '2026-11-25')).toEqual({ from: 4.5, to: 16.5 })
  expect(rangeOf('3M', times, '2026-11-25')).toEqual({ from: 3.5, to: 16.5 })
  expect(rangeOf('6M', times, '2026-11-25')).toEqual({ from: 2.5, to: 16.5 })
  expect(rangeOf('YTD', times, '2026-11-25')).toEqual({ from: 1.5, to: 16.5 })
  expect(rangeOf('1Y', times, '2026-11-25')).toEqual({ from: 1.5, to: 16.5 })
  expect(rangeOf('5Y', times, '2026-11-25')).toEqual({ from: 0.5, to: 16.5 })
  expect(rangeOf('All', times, '2026-11-25')).toEqual({ from: -0.5, to: 16.5 })
})

test('Should centre the chart on a day and keep how many bars it shows', () => {
  expect(centerOn('2026-05-20', times, 4)).toEqual({ from: 1, to: 5 })
  expect(centerOn('2030-01-01', times, 4)).toEqual({ from: 4, to: 8 })
  expect(centerOn('2026-05-20', [], 4)).toBeNull()
})
