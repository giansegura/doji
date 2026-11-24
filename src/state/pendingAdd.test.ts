import { expect, test } from 'vitest'
import type { History } from '../../shared/types'
import { resolvePendingAdd } from './pendingAdd'

const history = (symbol: string, bars = 1): History => ({
  info: { symbol, name: `${symbol} Inc.`, exchange: 'NYSE' },
  bars: Array.from({ length: bars }, () => ({ time: '2026-11-23', open: 1, high: 1, low: 1, close: 1, volume: 1 })),
  splits: [],
  fetchedAt: 'x',
  stale: false,
})

test('Should wait while nothing is pending', () => {
  expect(resolvePendingAdd(null, { status: 'ready', history: history('KO'), errorCode: null })).toEqual({ type: 'wait' })
})

test('Should wait while the pending symbol is still loading', () => {
  expect(resolvePendingAdd('KO', { status: 'loading', history: null, errorCode: null })).toEqual({ type: 'wait' })
})

test('Should wait while the history on screen belongs to another symbol', () => {
  expect(resolvePendingAdd('KO', { status: 'ready', history: history('AAPL'), errorCode: null })).toEqual({ type: 'wait' })
})

test('Should add the symbol once its history arrives', () => {
  expect(resolvePendingAdd('KO', { status: 'ready', history: history('KO'), errorCode: null })).toEqual({
    type: 'add',
    info: { symbol: 'KO', name: 'KO Inc.', exchange: 'NYSE' },
  })
})

test('Should drop a symbol without data', () => {
  expect(resolvePendingAdd('NOEXISTE', { status: 'error', history: null, errorCode: 'not_found' })).toEqual({ type: 'drop' })
  expect(resolvePendingAdd('KO', { status: 'ready', history: history('KO', 0), errorCode: null })).toEqual({ type: 'drop' })
})

test('Should drop a symbol whose data could not be loaded', () => {
  expect(resolvePendingAdd('KO', { status: 'error', history: null, errorCode: 'unavailable' })).toEqual({ type: 'drop' })
})
