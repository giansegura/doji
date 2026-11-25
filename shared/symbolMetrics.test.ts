import { expect, test } from 'vitest'
import { rsi, sma } from './rsi'
import { addWeekdays } from './dates'
import { supportsAndResistances } from './levels'
import { symbolMetrics } from './symbolMetrics'
import type { Bar } from './types'

const START = '2015-01-05'

const barsOf = (closes: number[], volumeOf: (index: number) => number = () => 1000): Bar[] =>
  closes.map((close, index) => ({
    time: addWeekdays(START, index),
    open: close * 0.999,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: volumeOf(index),
  }))

const wave = Array.from({ length: 1500 }, (_, index) => {
  const phase = (Math.floor(index / 5) % 20) / 20
  return 100 + 20 * (phase < 0.5 ? phase * 2 : (1 - phase) * 2)
})

test('Should give the RSI 14 of the daily closes', () => {
  const bars = barsOf(wave)
  const expected = rsi(wave, 14).at(-1) as number
  expect(symbolMetrics('KO', bars, false).rsi).toBeCloseTo(expected, 2)
})

test('Should give how far the close is below the highest high of the last year', () => {
  const closes = [...Array.from({ length: 300 }, () => 100), 150, ...Array.from({ length: 20 }, () => 120)]
  expect(symbolMetrics('KO', barsOf(closes), false).fromHighPercent).toBeCloseTo(((120 - 151.5) / 151.5) * 100, 2)
})

test('Should give the volume of the last bar against the average of the last twenty', () => {
  const bars = barsOf(wave, (index) => (index === wave.length - 1 ? 3000 : 1000))
  const average = sma(bars.map((bar) => bar.volume), 20).at(-1) as number
  expect(symbolMetrics('KO', bars, false).volumeRatio).toBeCloseTo(3000 / average, 2)
})

test('Should give the nearest support or resistance with its signed distance only when asked', () => {
  const bars = barsOf(wave)
  const close = wave.at(-1) as number
  const found = supportsAndResistances('KO', bars, 1)
  const candidates = [...(found?.supports ?? []), ...(found?.resistances ?? [])]
  const nearest = candidates.sort((a, b) => Math.abs(a.price - close) - Math.abs(b.price - close))[0]
  const metrics = symbolMetrics('KO', bars, true)
  expect(metrics.level?.price).toBe(nearest.price)
  expect(metrics.level?.kind).toBe(nearest.price > close ? 'resistance' : 'support')
  expect(metrics.level?.percent).toBeCloseTo(((nearest.price - close) / close) * 100, 2)
  expect(symbolMetrics('KO', bars, false).level).toBeNull()
})

test('Should give nothing it cannot work out from too few bars', () => {
  expect(symbolMetrics('KO', barsOf([10, 11, 12]), true)).toEqual({ rsi: null, fromHighPercent: expect.any(Number), volumeRatio: null, level: null })
  expect(symbolMetrics('KO', [], true)).toEqual({ rsi: null, fromHighPercent: null, volumeRatio: null, level: null })
})
