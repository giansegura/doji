import { expect, test } from 'vitest'
import type { History } from '../../shared/types'
import { createHistoryStore } from './historyStore'

const historyOf = (symbol: string, close = 1): History => ({
  info: { symbol, name: symbol, exchange: 'NYSE' },
  bars: [{ time: '2026-11-23', open: 1, high: 1, low: 1, close, volume: 1 }],
  splits: [],
  fetchedAt: 'x',
  stale: false,
})

test('Should give back the history it keeps for a symbol, whatever its case', () => {
  const store = createHistoryStore()
  const kept = historyOf('AAPL')
  store.keep('AAPL', kept)
  expect(store.get('AAPL')).toBe(kept)
  expect(store.get('aapl')).toBe(kept)
  expect(store.has('aapl')).toBe(true)
})

test('Should know nothing about a symbol it never kept', () => {
  const store = createHistoryStore()
  expect(store.get('AAPL')).toBeNull()
  expect(store.has('AAPL')).toBe(false)
})

test('Should replace the history of a symbol with the newer one', () => {
  const store = createHistoryStore()
  const newer = historyOf('AAPL', 2)
  store.keep('AAPL', historyOf('AAPL', 1))
  store.keep('AAPL', newer)
  expect(store.get('AAPL')).toBe(newer)
})

test('Should forget the history kept longest ago once it holds too many', () => {
  const store = createHistoryStore(2)
  store.keep('A', historyOf('A'))
  store.keep('B', historyOf('B'))
  store.keep('C', historyOf('C'))
  expect(store.has('A')).toBe(false)
  expect(store.has('B')).toBe(true)
  expect(store.has('C')).toBe(true)
})

test('Should count a history kept again as recent', () => {
  const store = createHistoryStore(2)
  store.keep('A', historyOf('A'))
  store.keep('B', historyOf('B'))
  store.keep('A', historyOf('A', 2))
  store.keep('C', historyOf('C'))
  expect(store.has('A')).toBe(true)
  expect(store.has('B')).toBe(false)
})
