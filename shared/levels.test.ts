import { expect, test } from 'vitest'
import { addWeekdays } from './dates'
import { supportsAndResistances } from './levels'
import type { Bar } from './types'

const START = '2015-01-05'

const weekdaysFrom = (start: string, count: number): string[] => {
  const days = [start]
  while (days.length < count) days.push(addWeekdays(days[days.length - 1], 1))
  return days
}

const barsFrom = (weekly: number[]): Bar[] => {
  const days = weekdaysFrom(START, weekly.length * 5)
  return weekly.flatMap((value, week) =>
    Array.from({ length: 5 }, (_, day) => {
      const close = value * (1 + (day - 2) * 0.002)
      return {
        time: days[week * 5 + day],
        open: close * 0.999,
        high: close * 1.01,
        low: close * 0.99,
        close,
        volume: 1000,
      }
    }),
  )
}

const triangle = (weeks: number, low: number, high: number, period: number): number[] =>
  Array.from({ length: weeks }, (_, week) => {
    const phase = (week % period) / period
    return low + (high - low) * (phase < 0.5 ? phase * 2 : (1 - phase) * 2)
  })

const near = (value: number, target: number, share = 0.03): boolean => Math.abs(value - target) <= target * share

test('Should find the floor and the ceiling of a range the price keeps bouncing between', () => {
  const levels = supportsAndResistances('KO', barsFrom([...triangle(300, 100, 120, 20), 108, 109, 110]), 3)
  expect(levels?.resistances.some((level) => near(level.price, 120 * 1.01) && level.ath)).toBe(true)
  expect(levels?.supports.some((level) => near(level.price, 100 * 0.99) && level.touches >= 3)).toBe(true)
  expect(levels?.supports.every((level) => level.touches >= 3)).toBe(true)
})

test('Should give no more levels per side than asked for, nearest first', () => {
  const levels = supportsAndResistances('KO', barsFrom([...triangle(300, 80, 130, 26), 104, 105, 105]), 1)
  expect(levels?.resistances.length).toBeLessThanOrEqual(1)
  expect(levels?.supports.length).toBeLessThanOrEqual(1)
  const wide = supportsAndResistances('KO', barsFrom([...triangle(300, 80, 130, 26), 104, 105, 105]), 3)
  const prices = wide?.supports.map((level) => level.price) ?? []
  expect(prices).toEqual([...prices].sort((a, b) => b - a))
})

test('Should keep the levels within thirty percent of the price and apart from each other', () => {
  const levels = supportsAndResistances('KO', barsFrom([...triangle(400, 40, 200, 30), 100, 101, 102]), 3)
  const price = levels?.price ?? 0
  const all = [...(levels?.resistances ?? []), ...(levels?.supports ?? [])]
  expect(all.length).toBeGreaterThan(0)
  expect(all.every((level) => level.price <= price * 1.3 && level.price >= price * 0.7)).toBe(true)
  const sorted = all.map((level) => level.price).sort((a, b) => a - b)
  const tolerance = levels?.tolerance ?? 0
  expect(sorted.every((value, index) => index === 0 || value - sorted[index - 1] > sorted[index - 1] * tolerance * 2)).toBe(true)
})

test('Should always show an all-time high that is less than fifteen percent away', () => {
  const rise = Array.from({ length: 200 }, (_, week) => 50 + week * 0.5)
  const fall = Array.from({ length: 10 }, (_, week) => 150 - week * 1.5)
  const levels = supportsAndResistances('KO', barsFrom([...rise, ...fall]), 3)
  const top = Math.max(...barsFrom([...rise, ...fall]).map((bar) => bar.high))
  expect(levels?.resistances.find((level) => level.ath)?.price).toBeCloseTo(top, 1)
})

test('Should work on daily bars when the history is shorter than two years and give nothing for a few days', () => {
  const young = supportsAndResistances('NEW', barsFrom(triangle(60, 20, 30, 12)), 3)
  expect(young).not.toBeNull()
  expect(supportsAndResistances('NEW', barsFrom([10, 11]), 3)).toBeNull()
})

test('Should round the levels to the decimals of the symbol', () => {
  const levels = supportsAndResistances('EUR=X', barsFrom(triangle(300, 0.9, 1.1, 20).map((value) => value)), 3)
  const all = [...(levels?.resistances ?? []), ...(levels?.supports ?? [])]
  expect(all.length).toBeGreaterThan(0)
  expect(all.every((level) => Number(level.price.toFixed(4)) === level.price)).toBe(true)
})

test('Should show the all-time high as a resistance even when the price is just under it', () => {
  const rise = Array.from({ length: 200 }, (_, week) => 50 + week * 0.25)
  const levels = supportsAndResistances('KO', barsFrom(rise), 3)
  const top = Math.max(...barsFrom(rise).map((bar) => bar.high))
  expect(levels?.resistances.find((level) => level.ath)?.price).toBeCloseTo(top, 1)
})

test('Should keep a support and a resistance apart from each other too', () => {
  const levels = supportsAndResistances('KO', barsFrom([...triangle(300, 90, 110, 10), 96, 96, 96]), 3)
  const tolerance = levels?.tolerance ?? 0
  const nearestAbove = levels?.resistances[0]?.price ?? Number.POSITIVE_INFINITY
  const nearestBelow = levels?.supports[0]?.price ?? 0
  expect(nearestAbove - nearestBelow).toBeGreaterThan(nearestBelow * tolerance * 2)
})

test('Should measure how far each level is from the price before rounding it', () => {
  const levels = supportsAndResistances('KO', barsFrom([...triangle(300, 100, 120, 20), 108, 109, 110]), 3)
  const price = levels?.price ?? 0
  expect(levels?.resistances.every((level) => level.distance > 0 && Math.abs(level.distance - (level.price - price) / price) < 0.0001)).toBe(true)
  expect(levels?.supports.every((level) => level.distance <= 0)).toBe(true)
})
