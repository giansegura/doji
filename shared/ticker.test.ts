import { describe, expect, test } from 'vitest'
import { DEFAULT_TICKER, MAX_TICKER_ITEMS, addToTicker, removeFromTicker, toTicker } from './ticker'

describe('toTicker', () => {
  test('Should start visible with the six market symbols when nothing is saved', () => {
    expect(toTicker(undefined)).toEqual(DEFAULT_TICKER)
    expect(DEFAULT_TICKER.visible).toBe(true)
    expect(DEFAULT_TICKER.items.map((item) => item.symbol)).toEqual(['^GSPC', '^IXIC', '^VIX', 'EURUSD=X', 'GC=F', 'BTC-USD'])
    expect(DEFAULT_TICKER.items.map((item) => item.name)).toEqual(['S&P 500', 'Nasdaq', 'VIX', 'EUR/USD', 'Gold', 'Bitcoin'])
  })

  test('Should keep a hidden ticker and its chosen symbols', () => {
    const saved = { visible: false, items: [{ symbol: 'AAPL', name: 'AAPL' }] }
    expect(toTicker(saved)).toEqual(saved)
  })

  test('Should keep an emptied ticker empty', () => {
    expect(toTicker({ visible: true, items: [] })).toEqual({ visible: true, items: [] })
  })

  test('Should drop invalid or repeated symbols and fill a missing name with the symbol', () => {
    const saved = {
      visible: 'yes',
      items: [{ symbol: 'AAPL' }, { symbol: 'aapl', name: 'Apple' }, { symbol: 'not a symbol', name: 'X' }, 'MSFT', null, { symbol: '^VIX', name: '  ' }],
    }
    expect(toTicker(saved)).toEqual({
      visible: true,
      items: [
        { symbol: 'AAPL', name: 'AAPL' },
        { symbol: '^VIX', name: '^VIX' },
      ],
    })
  })

  test('Should keep at most the allowed number of symbols', () => {
    const items = Array.from({ length: MAX_TICKER_ITEMS + 3 }, (_, index) => ({ symbol: `S${index}`, name: `S${index}` }))
    expect(toTicker({ visible: true, items }).items).toHaveLength(MAX_TICKER_ITEMS)
  })
})

describe('addToTicker', () => {
  test('Should add a symbol at the end named by its ticker', () => {
    const ticker = addToTicker({ visible: true, items: [] }, 'EURGBP=X')
    expect(ticker.items).toEqual([{ symbol: 'EURGBP=X', name: 'EURGBP' }])
  })

  test('Should not add a symbol that is already there', () => {
    expect(addToTicker(DEFAULT_TICKER, 'btc-usd')).toBe(DEFAULT_TICKER)
  })

  test('Should not add more symbols than the limit', () => {
    const items = Array.from({ length: MAX_TICKER_ITEMS }, (_, index) => ({ symbol: `S${index}`, name: `S${index}` }))
    const full = { visible: true, items }
    expect(addToTicker(full, 'AAPL')).toBe(full)
  })
})

describe('removeFromTicker', () => {
  test('Should remove the symbol and keep the rest in order', () => {
    expect(removeFromTicker(DEFAULT_TICKER, '^VIX').items.map((item) => item.symbol)).toEqual(['^GSPC', '^IXIC', 'EURUSD=X', 'GC=F', 'BTC-USD'])
  })

  test('Should leave the ticker alone when the symbol is not in it', () => {
    expect(removeFromTicker(DEFAULT_TICKER, 'AAPL')).toBe(DEFAULT_TICKER)
  })
})
