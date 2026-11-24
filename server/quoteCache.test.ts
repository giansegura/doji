import { expect, test } from 'vitest'
import type { Quote } from '../shared/types'
import { QUOTE_FRESH_MS, createQuoteCache } from './quoteCache'

const quote = (symbol: string, price: number): Quote => ({ symbol, price, change: 1, changePercent: 1 })

const setup = (source?: (symbols: string[]) => Promise<Quote[]>) => {
  const clock = { ms: Date.parse('2026-11-23T20:00:00.000Z') }
  const asked: string[][] = []
  let price = 10
  const cache = createQuoteCache({
    fetch: async (symbols) => {
      asked.push(symbols)
      price += 1
      return (source ?? (async (list: string[]) => list.map((symbol) => quote(symbol, price))))(symbols)
    },
    now: () => new Date(clock.ms),
  })
  return { cache, asked, clock }
}

test('Should fetch the quotes it does not have', async () => {
  const { cache, asked } = setup()
  expect(await cache.get(['AAPL', 'MSFT'])).toEqual([quote('AAPL', 11), quote('MSFT', 11)])
  expect(asked).toEqual([['AAPL', 'MSFT']])
})

test('Should answer from memory while the quotes are fresh', async () => {
  const { cache, asked, clock } = setup()
  await cache.get(['AAPL', 'MSFT'])
  clock.ms += QUOTE_FRESH_MS - 1
  expect(await cache.get(['MSFT', 'AAPL'])).toEqual([quote('MSFT', 11), quote('AAPL', 11)])
  expect(asked).toHaveLength(1)
})

test('Should fetch again once the quotes are old', async () => {
  const { cache, asked, clock } = setup()
  await cache.get(['AAPL'])
  clock.ms += QUOTE_FRESH_MS
  expect(await cache.get(['AAPL'])).toEqual([quote('AAPL', 12)])
  expect(asked).toEqual([['AAPL'], ['AAPL']])
})

test('Should fetch only the symbols that are missing or old', async () => {
  const { cache, asked } = setup()
  await cache.get(['AAPL'])
  expect(await cache.get(['AAPL', 'KO'])).toEqual([quote('AAPL', 11), quote('KO', 12)])
  expect(asked).toEqual([['AAPL'], ['KO']])
})

test('Should share one fetch between requests that overlap', async () => {
  const { cache, asked } = setup()
  const [first, second] = await Promise.all([cache.get(['AAPL', 'MSFT']), cache.get(['MSFT', 'KO'])])
  expect(first).toEqual([quote('AAPL', 11), quote('MSFT', 11)])
  expect(second).toEqual([quote('MSFT', 11), quote('KO', 12)])
  expect(asked).toEqual([['AAPL', 'MSFT'], ['KO']])
})

test('Should leave out and remember the symbols without a quote', async () => {
  const { cache, asked } = setup(async (symbols) => symbols.filter((symbol) => symbol !== 'NOPE').map((symbol) => quote(symbol, 5)))
  expect(await cache.get(['AAPL', 'NOPE'])).toEqual([quote('AAPL', 5)])
  expect(await cache.get(['NOPE'])).toEqual([])
  expect(asked).toHaveLength(1)
})

test('Should pass a failure on and try again the next time', async () => {
  let failing = true
  const { cache, asked } = setup(async (symbols) => {
    if (failing) throw new Error('sin red')
    return symbols.map((symbol) => quote(symbol, 7))
  })
  await expect(cache.get(['AAPL'])).rejects.toThrow('sin red')
  failing = false
  expect(await cache.get(['AAPL'])).toEqual([quote('AAPL', 7)])
  expect(asked).toHaveLength(2)
})

test('Should not ask the source for an empty list', async () => {
  const { cache, asked } = setup()
  expect(await cache.get([])).toEqual([])
  expect(asked).toEqual([])
})
