import { expect, test } from 'vitest'
import type { Bar } from '../../shared/types'
import { findPatterns } from './patterns'

const bar = (open: number, high: number, low: number, close: number, index: number): Bar => ({
  time: `2026-01-${String(index + 1).padStart(2, '0')}`,
  open,
  high,
  low,
  close,
  volume: 1000,
})

const falling = [110, 108, 106, 104, 102, 100].map((close, index) => bar(close + 1, close + 1.5, close - 0.5, close, index))
const rising = [100, 102, 104, 106, 108, 110].map((close, index) => bar(close - 1, close + 0.5, close - 1.5, close, index))

const ALL = ['doji', 'hammer', 'shootingStar', 'bullishEngulfing', 'bearishEngulfing'] as const

test('Should mark a hammer only after a fall', () => {
  const hammer = bar(99.6, 100, 96, 99.9, 6)
  expect(findPatterns([...falling, hammer], [...ALL])).toEqual([{ index: 6, kind: 'hammer' }])
  expect(findPatterns([...rising, { ...hammer, open: 109.6, high: 110, low: 106, close: 109.9 }], [...ALL])).toEqual([])
})

test('Should mark a shooting star only after a rise', () => {
  const star = bar(110.4, 114, 110, 110.1, 6)
  expect(findPatterns([...rising, star], [...ALL])).toEqual([{ index: 6, kind: 'shootingStar' }])
})

test('Should mark a bullish engulfing after a fall and a bearish one after a rise', () => {
  const engulfing = bar(99.5, 103, 99, 102.5, 6)
  expect(findPatterns([...falling, engulfing], [...ALL])).toEqual([{ index: 6, kind: 'bullishEngulfing' }])
  const down = bar(110.5, 111, 107, 107.5, 6)
  expect(findPatterns([...rising, down], [...ALL])).toEqual([{ index: 6, kind: 'bearishEngulfing' }])
})

test('Should mark a doji after a clear move and leave out the kinds not chosen', () => {
  const doji = bar(100, 101.5, 98.5, 100.05, 6)
  expect(findPatterns([...falling, doji], [...ALL])).toEqual([{ index: 6, kind: 'doji' }])
  expect(findPatterns([...falling, doji], ['hammer'])).toEqual([])
})

test('Should mark nothing without enough bars before, or in a flat market', () => {
  const flat = Array.from({ length: 7 }, (_, index) => bar(100, 101.5, 98.5, 100.05, index))
  expect(findPatterns(flat, [...ALL])).toEqual([])
  expect(findPatterns(falling.slice(0, 3), [...ALL])).toEqual([])
})
