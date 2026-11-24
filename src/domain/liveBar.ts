import { dayInZone } from '../../shared/dates'
import type { Bar, History, Quote } from '../../shared/types'

export type LivePrice = {
  symbol: string
  price: number
  time: number
  day: string
  volume: number | null
  high?: number
  low?: number
}

type Trade = { time: number; price: number }

type Range = { high: number; low: number; until: number }

export type SeenTrades = { symbol: string; day: string; trades: Trade[]; older?: Range }

const MAX_SEEN_TRADES = 300

export const livePriceOf = (quote: Quote | undefined): LivePrice | null => {
  if (!quote || quote.time === undefined || quote.timezone === undefined) return null
  return {
    symbol: quote.symbol,
    price: quote.price,
    time: quote.time,
    day: dayInZone(quote.timezone, quote.time),
    volume: quote.volume ?? null,
  }
}

const isNews = (history: History, last: Bar, live: LivePrice): boolean =>
  live.symbol.toUpperCase() === history.info.symbol.toUpperCase() &&
  live.day === last.time &&
  (history.tradedAt === undefined || live.time > history.tradedAt)

export const withLivePrice = (history: History, live: LivePrice | null): Bar[] => {
  const last = history.bars.at(-1)
  if (!last || !live || !isNews(history, last, live)) return history.bars
  const volume = Math.max(last.volume, live.volume ?? 0)
  const high = Math.max(last.high, live.high ?? live.price)
  const low = Math.min(last.low, live.low ?? live.price)
  if (live.price === last.close && volume === last.volume && high === last.high && low === last.low) return history.bars
  return [...history.bars.slice(0, -1), { ...last, high, low, close: live.price, volume }]
}

const tradeOf = (quote: Quote, history: History): { close: number; time: number; today: boolean } | null => {
  const last = history.bars.at(-1)
  const { tradedAt } = history
  if (!last || tradedAt === undefined || quote.time === undefined || quote.timezone === undefined) return null
  const news =
    quote.symbol.toUpperCase() === history.info.symbol.toUpperCase() &&
    tradedAt > quote.time &&
    dayInZone(quote.timezone, tradedAt) === last.time
  return news ? { close: last.close, time: tradedAt, today: dayInZone(quote.timezone, quote.time) === last.time } : null
}

export const withHistoryTrade = (quote: Quote | undefined, history: History | null): Quote | undefined => {
  const trade = quote && history ? tradeOf(quote, history) : null
  if (!quote || !trade) return quote
  const previousClose = trade.today ? quote.price - quote.change : quote.price
  const change = trade.close - previousClose
  const { volume, ...rest } = quote
  return {
    ...rest,
    price: trade.close,
    change,
    changePercent: previousClose !== 0 ? (change / previousClose) * 100 : 0,
    time: trade.time,
    ...(trade.today && volume !== undefined ? { volume } : {}),
  }
}

export const freshQuotes = (quotes: Record<string, Quote>, history: History | null): Record<string, Quote> => {
  const symbol = history?.info.symbol
  const quote = symbol === undefined ? undefined : quotes[symbol]
  const fresh = withHistoryTrade(quote, history)
  return symbol === undefined || fresh === undefined || fresh === quote ? quotes : { ...quotes, [symbol]: fresh }
}

const isSameSymbol = (history: History, live: LivePrice): boolean =>
  live.symbol.toUpperCase() === history.info.symbol.toUpperCase()

const sameTrades = (a: Trade[], b: Trade[]): boolean =>
  a.length === b.length && a.every((trade, index) => trade.time === b[index].time && trade.price === b[index].price)

const foldRange = (range: Range | undefined, trades: Trade[]): Range | undefined => {
  if (trades.length === 0) return range
  const prices = trades.map((trade) => trade.price)
  const until = Math.max(...trades.map((trade) => trade.time))
  if (!range) return { high: Math.max(...prices), low: Math.min(...prices), until }
  return { high: Math.max(range.high, ...prices), low: Math.min(range.low, ...prices), until: Math.max(range.until, until) }
}

export const seeTrade = (seen: SeenTrades | null, history: History | null, live: LivePrice | null): SeenTrades | null => {
  const last = history?.bars.at(-1)
  if (!history || !last || !live || !isSameSymbol(history, live) || live.day !== last.time) return null
  const since = history.tradedAt ?? Number.NEGATIVE_INFINITY
  const same = seen !== null && seen.symbol === live.symbol && seen.day === live.day
  const known = same ? seen.trades : []
  const latest = known.at(-1)
  const repeated = latest !== undefined && latest.time === live.time && latest.price === live.price
  const uncovered = (repeated ? known : [...known, { time: live.time, price: live.price }]).filter((trade) => trade.time > since)
  const dropped = uncovered.slice(0, Math.max(uncovered.length - MAX_SEEN_TRADES, 0))
  const trades = uncovered.slice(dropped.length)
  const kept = same && seen.older && seen.older.until > since ? seen.older : undefined
  const older = foldRange(kept, dropped)
  if (same && sameTrades(trades, known) && older === seen.older) return seen
  return { symbol: live.symbol, day: live.day, trades, ...(older ? { older } : {}) }
}

export const withSeenRange = (live: LivePrice | null, seen: SeenTrades | null): LivePrice | null => {
  if (!live || !seen || (seen.trades.length === 0 && !seen.older)) return live
  const prices = seen.trades.map((trade) => trade.price)
  const highs = seen.older ? [...prices, seen.older.high] : prices
  const lows = seen.older ? [...prices, seen.older.low] : prices
  return { ...live, high: Math.max(...highs), low: Math.min(...lows) }
}
