import { SYMBOL_PATTERN, displaySymbol } from './symbols'

export type TickerItem = { symbol: string; name: string }

export type Ticker = { visible: boolean; items: TickerItem[] }

export const MAX_TICKER_ITEMS = 12

export const DEFAULT_TICKER: Ticker = {
  visible: true,
  items: [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^IXIC', name: 'Nasdaq' },
    { symbol: '^VIX', name: 'VIX' },
    { symbol: 'EURUSD=X', name: 'EUR/USD' },
    { symbol: 'GC=F', name: 'Gold' },
    { symbol: 'BTC-USD', name: 'Bitcoin' },
  ],
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

const toItem = (raw: unknown): TickerItem | null => {
  if (!isRecord(raw) || typeof raw.symbol !== 'string' || !SYMBOL_PATTERN.test(raw.symbol)) return null
  const symbol = raw.symbol.toUpperCase()
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : symbol
  return { symbol, name }
}

const sameSymbol = (item: TickerItem, symbol: string): boolean => item.symbol === symbol.toUpperCase()

export const toTicker = (raw: unknown): Ticker => {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return DEFAULT_TICKER
  const items = raw.items
    .map(toItem)
    .filter((item): item is TickerItem => item !== null)
    .filter((item, index, all) => all.findIndex((other) => other.symbol === item.symbol) === index)
    .slice(0, MAX_TICKER_ITEMS)
  return { visible: raw.visible !== false, items }
}

export const addToTicker = (ticker: Ticker, symbol: string): Ticker => {
  if (ticker.items.some((item) => sameSymbol(item, symbol)) || ticker.items.length >= MAX_TICKER_ITEMS) return ticker
  const upper = symbol.toUpperCase()
  return { ...ticker, items: [...ticker.items, { symbol: upper, name: displaySymbol(upper) }] }
}

export const removeFromTicker = (ticker: Ticker, symbol: string): Ticker =>
  ticker.items.some((item) => sameSymbol(item, symbol)) ? { ...ticker, items: ticker.items.filter((item) => !sameSymbol(item, symbol)) } : ticker
