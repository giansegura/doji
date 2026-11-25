import { expect, test } from 'vitest'
import { convertHistory, convertPrice, fxPairOf } from './currency'
import type { Bar, History } from './types'

const bar = (time: string, close: number): Bar => ({ time, open: close, high: close + 2, low: close - 2, close, volume: 100 })

const history: History = {
  info: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  bars: [bar('2026-11-18', 100), bar('2026-11-19', 110), bar('2026-11-20', 120), bar('2026-11-23', 130)],
  splits: [],
  dividends: [{ date: '2026-11-20', amount: 0.25 }],
  fetchedAt: 'x',
  stale: false,
  currency: 'USD',
}

const fx: Bar[] = [bar('2026-11-19', 1.1), bar('2026-11-20', 1.25), bar('2026-11-24', 1)]

test('Should find the euro pair of each currency and the cents some markets quote in', () => {
  expect(fxPairOf('USD')).toEqual({ pair: 'EURUSD=X', factor: 1 })
  expect(fxPairOf('GBp')).toEqual({ pair: 'EURGBP=X', factor: 0.01 })
  expect(fxPairOf('ZAc')).toEqual({ pair: 'EURZAR=X', factor: 0.01 })
  expect(fxPairOf('EUR')).toBeNull()
  expect(fxPairOf(undefined)).toBeNull()
})

test('Should turn each bar into euros with the rate of its own day, or the last one before it', () => {
  const euros = convertHistory(history, fx, 1)
  expect(euros.bars.map((item) => item.time)).toEqual(['2026-11-19', '2026-11-20', '2026-11-23'])
  const [first] = euros.bars
  expect([first.open, first.high, first.low, first.close].map((price) => Number(price.toFixed(6)))).toEqual([100, 101.818182, 98.181818, 100])
  expect(first.volume).toBe(100)
  expect(euros.bars[1].close).toBeCloseTo(96, 6)
  expect(euros.bars[2].close).toBeCloseTo(104, 6)
  expect(euros.dividends).toEqual([{ date: '2026-11-20', amount: 0.2 }])
  expect(euros.currency).toBe('EUR')
})

test('Should turn pence into pounds before turning them into euros', () => {
  const pence = { ...history, currency: 'GBp', bars: [bar('2026-11-20', 250)] }
  expect(convertHistory(pence, fx, 0.01).bars[0].close).toBeCloseTo(2, 6)
})

test('Should turn a live price into euros with the latest rate', () => {
  expect(convertPrice(125, fx, 1)).toBe(125)
  expect(convertPrice(125, [], 1)).toBeNull()
})
