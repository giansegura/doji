import { expect, test } from 'vitest'
import { bollinger, ema, macd } from './studies'

const close = (values: (number | null)[], expected: (number | null)[]): void => {
  expect(values).toHaveLength(expected.length)
  values.forEach((value, index) => {
    const wanted = expected[index]
    if (wanted === null || value === null) expect(value).toBe(wanted)
    else expect(value).toBeCloseTo(wanted, 9)
  })
}

test('Should start an exponential average from the simple average of its first window', () => {
  close(ema([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4])
})

test('Should weigh the latest value by two over the length plus one', () => {
  close(ema([10, 10, 10, 22], 3), [null, null, 10, 16])
})

test('Should wait for enough values after the ones that are missing', () => {
  close(ema([null, null, 1, 2, 3, 4], 3), [null, null, null, null, 2, 3])
})

test('Should give no exponential average with fewer values than its length', () => {
  close(ema([1, 2], 3), [null, null])
  close(ema([], 3), [])
})

test('Should put the bands a number of standard deviations around the simple average', () => {
  const out = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2)
  close(out.basis, [null, null, null, null, null, null, null, 5])
  close(out.upper, [null, null, null, null, null, null, null, 9])
  close(out.lower, [null, null, null, null, null, null, null, 1])
})

test('Should slide the bands one bar at a time', () => {
  const out = bollinger([1, 3, 1, 3], 2, 1)
  close(out.basis, [null, 2, 2, 2])
  close(out.upper, [null, 3, 3, 3])
  close(out.lower, [null, 1, 1, 1])
})

test('Should close the bands on the average when the prices do not move', () => {
  const out = bollinger([7, 7, 7], 2, 2)
  close(out.upper, [null, 7, 7])
  close(out.lower, [null, 7, 7])
})

test('Should measure the gap between a fast and a slow average, its own average and their difference', () => {
  const closes = [1, 2, 3, 4, 5, 6, 7, 8]
  const out = macd(closes, 2, 4, 2)
  close(out.macd, [null, null, null, 1, 1, 1, 1, 1])
  close(out.signal, [null, null, null, null, 1, 1, 1, 1])
  close(out.histogram, [null, null, null, null, 0, 0, 0, 0])
})

test('Should show a positive histogram while the gap grows faster than its average', () => {
  const out = macd([10, 10, 10, 10, 10, 14, 20, 28], 2, 4, 2)
  const last = out.histogram.at(-1) ?? null
  expect(last).not.toBeNull()
  expect(last as number).toBeGreaterThan(0)
  expect(out.macd.at(-1) as number).toBeGreaterThan(out.signal.at(-1) as number)
})
