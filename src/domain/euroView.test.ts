import { expect, test } from 'vitest'
import type { Bar } from '../../shared/types'
import { euroLive } from './euroView'

const fx: Bar[] = [{ time: '2026-11-24', open: 1.25, high: 1.25, low: 1.25, close: 1.25, volume: 0 }]

test('Should turn the live price, its high and its low into euros', () => {
  expect(euroLive({ symbol: 'AAPL', price: 125, time: 1, day: '2026-11-25', volume: 10, high: 130, low: 120 }, fx, 1)).toEqual({
    symbol: 'AAPL',
    price: 100,
    time: 1,
    day: '2026-11-25',
    volume: 10,
    high: 104,
    low: 96,
  })
  expect(euroLive({ symbol: 'VOD.L', price: 250, time: 1, day: '2026-11-25', volume: null }, fx, 0.01)).toEqual({
    symbol: 'VOD.L',
    price: 2,
    time: 1,
    day: '2026-11-25',
    volume: null,
  })
  expect(euroLive(null, fx, 1)).toBeNull()
  expect(euroLive({ symbol: 'AAPL', price: 125, time: 1, day: '2026-11-25', volume: 10 }, [], 1)).toBeNull()
})
