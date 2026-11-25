import { expect, test } from 'vitest'
import type { Bar } from '../../shared/types'
import { findOpenGaps } from './gaps'

const bar = (low: number, high: number, index: number): Bar => ({
  time: `2026-11-${String(index + 1).padStart(2, '0')}`,
  open: low,
  high,
  low,
  close: high,
  volume: 1,
})

test('Should find a gap up and a gap down the price has not filled yet', () => {
  expect(findOpenGaps([bar(98, 100, 0), bar(103, 105, 1), bar(104, 106, 2)], 1)).toEqual([{ index: 1, top: 103, bottom: 100, direction: 'up' }])
  expect(findOpenGaps([bar(104, 106, 0), bar(90, 95, 1), bar(91, 94, 2)], 1)).toEqual([{ index: 1, top: 104, bottom: 95, direction: 'down' }])
})

test('Should count a later gap the other way as filling the first one when it crosses it', () => {
  const bars = [bar(98, 100, 0), bar(103, 105, 1), bar(104, 106, 2), bar(90, 95, 3)]
  expect(findOpenGaps(bars, 1)).toEqual([{ index: 3, top: 104, bottom: 95, direction: 'down' }])
})

test('Should shrink a gap the price went into and drop it once filled', () => {
  const partly = [bar(98, 100, 0), bar(103, 105, 1), bar(101.5, 104, 2)]
  expect(findOpenGaps(partly, 1)).toEqual([{ index: 1, top: 101.5, bottom: 100, direction: 'up' }])
  const filled = [...partly, bar(99.5, 102, 3)]
  expect(findOpenGaps(filled, 1)).toEqual([])
})

test('Should skip the gaps smaller than the size asked for', () => {
  const bars = [bar(98, 100, 0), bar(100.5, 102, 1)]
  expect(findOpenGaps(bars, 1)).toEqual([])
  expect(findOpenGaps(bars, 0.2)).toEqual([{ index: 1, top: 100.5, bottom: 100, direction: 'up' }])
})

test('Should count a gap exactly as big as the minimum', () => {
  expect(findOpenGaps([bar(98, 100, 0), bar(101, 103, 1)], 1)).toEqual([{ index: 1, top: 101, bottom: 100, direction: 'up' }])
  expect(findOpenGaps([bar(100, 102, 0), bar(97, 99, 1)], 1)).toEqual([{ index: 1, top: 100, bottom: 99, direction: 'down' }])
  expect(findOpenGaps([bar(98, 100, 0), bar(100.9, 103, 1)], 1)).toEqual([])
})
