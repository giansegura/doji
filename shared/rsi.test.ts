import { expect, test } from 'vitest'
import { rsi, sma } from './rsi'

test('Should compute Wilder RSI', () => {
  const out = rsi([10, 11, 12, 11, 13], 2)
  expect(out.slice(0, 2)).toEqual([null, null])
  expect(out[2]).toBeCloseTo(100, 6)
  expect(out[3]).toBeCloseTo(50, 6)
  expect(out[4]).toBeCloseTo(83.333333, 5)
})

test('Should return 100 when there are no losses', () => {
  expect(rsi([5, 5, 5, 5], 2)).toEqual([null, null, 100, 100])
})

test('Should return 0 when there are only losses', () => {
  expect(rsi([10, 9, 8, 7], 2)).toEqual([null, null, 0, 0])
})

test('Should return only nulls when history is shorter than the length', () => {
  expect(rsi([10, 11, 12], 14)).toEqual([null, null, null])
  expect(rsi([], 14)).toEqual([])
})

test('Should stay within 0 and 100', () => {
  const closes = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 3) * 10 + (i % 7))
  const values = rsi(closes, 14).filter((v): v is number => v !== null)
  expect(values).toHaveLength(186)
  expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
  expect(Math.max(...values)).toBeLessThanOrEqual(100)
})

test('Should compute a simple moving average ignoring the warm-up', () => {
  expect(sma([null, null, 100, 50, 80], 2)).toEqual([null, null, null, 75, 65])
})

test('Should return only nulls when there are not enough values to average', () => {
  expect(sma([null, 10], 2)).toEqual([null, null])
})

test('Should average a long series in one pass', () => {
  const values = Array.from({ length: 200_000 }, (_, index) => 100 + Math.sin(index / 50) * 20)
  const started = performance.now()
  const averaged = sma(values, 5000)
  expect(performance.now() - started).toBeLessThan(250)
  expect(averaged[4998]).toBe(null)
  expect(averaged[4999]).toBeCloseTo(values.slice(0, 5000).reduce((sum, value) => sum + value, 0) / 5000, 9)
  expect(averaged[199_999]).toBeCloseTo(values.slice(195_000).reduce((sum, value) => sum + value, 0) / 5000, 9)
})

test('Should resume averaging once a gap leaves the window', () => {
  expect(sma([1, null, 3, 5, 7], 2)).toEqual([null, null, null, 4, 6])
  expect(sma([null, null, 2, 4, 6, 8], 3)).toEqual([null, null, null, null, 4, 6])
})

test('Should average without drifting on exact values', () => {
  const values = Array.from({ length: 3000 }, (_, index) => (index % 7) * 0.1 + 100)
  const plain = values.map((_, index) =>
    index < 199 ? null : values.slice(index - 199, index + 1).reduce((sum, value) => sum + value, 0) / 200,
  )
  const averaged = sma(values, 200)
  expect(averaged.map((value) => (value === null ? null : Number(value.toFixed(9))))).toEqual(
    plain.map((value) => (value === null ? null : Number(value.toFixed(9)))),
  )
})
