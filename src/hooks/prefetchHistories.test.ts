import { expect, test } from 'vitest'
import type { History } from '../../shared/types'
import { createHistoryStore } from './historyStore'
import { prefetchHistories } from './prefetchHistories'

const historyOf = (symbol: string, close = 1): History => ({
  info: { symbol, name: symbol, exchange: 'NYSE' },
  bars: [{ time: '2026-11-23', open: 1, high: 1, low: 1, close, volume: 1 }],
  splits: [],
  fetchedAt: 'x',
  stale: false,
})

const setup = (over: { fails?: string[]; activeFor?: number } = {}) => {
  const store = createHistoryStore()
  const steps: string[] = []
  let checks = 0
  const run = (symbols: string[]) =>
    prefetchHistories({
      symbols,
      store,
      fetchKept: async (symbol) => {
        steps.push(`ask ${symbol}`)
        if (over.fails?.includes(symbol)) throw new Error('unavailable')
        await Promise.resolve()
        steps.push(`got ${symbol}`)
        return historyOf(symbol)
      },
      pause: async () => {
        steps.push('pause')
      },
      isActive: () => {
        checks += 1
        return over.activeFor === undefined || checks <= over.activeFor
      },
    })
  return { store, steps, run }
}

test('Should keep the history of every symbol, asking for one at a time', async () => {
  const { store, steps, run } = setup()
  await run(['MSFT', 'NVDA'])
  expect(steps).toEqual(['ask MSFT', 'got MSFT', 'pause', 'ask NVDA', 'got NVDA', 'pause'])
  expect(store.has('MSFT')).toBe(true)
  expect(store.has('NVDA')).toBe(true)
})

test('Should skip the symbols whose history it already keeps', async () => {
  const { store, steps, run } = setup()
  store.keep('MSFT', historyOf('MSFT', 5))
  await run(['MSFT', 'NVDA'])
  expect(steps).toEqual(['ask NVDA', 'got NVDA', 'pause'])
  expect(store.get('MSFT')?.bars[0].close).toBe(5)
})

test('Should not replace a history that arrived while it was asking', async () => {
  const store = createHistoryStore()
  const fresher = historyOf('MSFT', 9)
  await prefetchHistories({
    symbols: ['MSFT'],
    store,
    fetchKept: async (symbol) => {
      store.keep(symbol, fresher)
      return historyOf(symbol, 1)
    },
    pause: async () => undefined,
    isActive: () => true,
  })
  expect(store.get('MSFT')).toBe(fresher)
})

test('Should go on with the next symbol after a failure', async () => {
  const { store, run } = setup({ fails: ['MSFT'] })
  await run(['MSFT', 'NVDA'])
  expect(store.has('MSFT')).toBe(false)
  expect(store.has('NVDA')).toBe(true)
})

test('Should stop as soon as it is no longer wanted', async () => {
  const { store, steps, run } = setup({ activeFor: 1 })
  await run(['MSFT', 'NVDA', 'AMZN'])
  expect(steps).toEqual(['ask MSFT', 'got MSFT', 'pause'])
  expect(store.has('NVDA')).toBe(false)
})
