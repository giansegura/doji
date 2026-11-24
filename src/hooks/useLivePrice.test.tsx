import { renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { History, Quote } from '../../shared/types'
import { useLivePrice } from './useLivePrice'

const MIDDAY = Date.parse('2026-11-24T17:00:00Z')

const history = (tradedAt: number): History => ({
  info: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  bars: [{ time: '2026-11-24', open: 100, high: 104, low: 98, close: 102, volume: 5_000 }],
  splits: [],
  fetchedAt: '2026-11-24T16:59:00.000Z',
  stale: false,
  tradedAt,
})

const quote = (price: number, time: number): Quote => ({
  symbol: 'AAPL',
  price,
  change: 1,
  changePercent: 1,
  time,
  timezone: 'America/New_York',
})

type Props = { data: History | null; current: Quote | undefined }

const start: Props = { data: history(MIDDAY - 10_000), current: quote(103, MIDDAY) }

const setup = () => renderHook(({ data, current }: Props) => useLivePrice(data, current), { initialProps: start })

test('Should give the live price of the quote with the range it went through', () => {
  const { result, rerender } = setup()
  expect(result.current).toMatchObject({ symbol: 'AAPL', price: 103, day: '2026-11-24', high: 103, low: 103 })
  rerender({ data: history(MIDDAY - 10_000), current: quote(106, MIDDAY + 1_000) })
  rerender({ data: history(MIDDAY - 10_000), current: quote(104, MIDDAY + 2_000) })
  expect(result.current).toMatchObject({ price: 104, high: 106, low: 103 })
})

test('Should drop from the range what a refreshed history already covers', () => {
  const { result, rerender } = setup()
  rerender({ data: history(MIDDAY - 10_000), current: quote(106, MIDDAY + 1_000) })
  rerender({ data: history(MIDDAY - 10_000), current: quote(104, MIDDAY + 2_000) })
  rerender({ data: history(MIDDAY + 1_000), current: quote(104, MIDDAY + 2_000) })
  expect(result.current).toMatchObject({ price: 104, high: 104, low: 104 })
})

test('Should give the live price without a range while the history is of another symbol', () => {
  const { result, rerender } = setup()
  const other = { ...history(MIDDAY - 10_000), info: { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ' } }
  rerender({ data: other, current: quote(106, MIDDAY + 1_000) })
  expect(result.current).toMatchObject({ symbol: 'AAPL', price: 106 })
  expect(result.current?.high).toBeUndefined()
})

test('Should have no live price without a quote', () => {
  const { result, rerender } = setup()
  rerender({ data: history(MIDDAY - 10_000), current: undefined })
  expect(result.current).toBeNull()
  rerender({ data: null, current: undefined })
  expect(result.current).toBeNull()
})
