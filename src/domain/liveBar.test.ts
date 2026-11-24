import { expect, test } from 'vitest'
import type { Bar, History, Quote } from '../../shared/types'
import {
  type LivePrice,
  type SeenTrades,
  freshQuotes,
  livePriceOf,
  seeTrade,
  withHistoryTrade,
  withLivePrice,
  withSeenRange,
} from './liveBar'

const MIDDAY = Date.parse('2026-11-24T17:00:00Z')

const bar = (time: string, close: number, over: Partial<Bar> = {}): Bar => ({
  time,
  open: 100,
  high: 104,
  low: 98,
  close,
  volume: 5_000,
  ...over,
})

const history = (over: Partial<History> = {}): History => ({
  info: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  bars: [bar('2026-11-23', 101), bar('2026-11-24', 102)],
  splits: [],
  fetchedAt: '2026-11-24T16:59:00.000Z',
  stale: false,
  tradedAt: MIDDAY - 10_000,
  ...over,
})

const live = (over: Partial<LivePrice> = {}): LivePrice => ({
  symbol: 'AAPL',
  price: 103,
  time: MIDDAY,
  day: '2026-11-24',
  volume: 6_000,
  ...over,
})

test('Should read the live price of a quote with the day it belongs to in its exchange', () => {
  const quote: Quote = { symbol: 'AAPL', price: 103, change: 1, changePercent: 1, time: MIDDAY, timezone: 'America/New_York', volume: 6_000 }
  expect(livePriceOf(quote)).toEqual(live())
  expect(livePriceOf({ ...quote, time: Date.parse('2026-11-25T02:00:00Z'), timezone: 'Asia/Tokyo', volume: undefined })).toEqual(
    live({ time: Date.parse('2026-11-25T02:00:00Z'), day: '2026-11-25', volume: null }),
  )
})

test('Should have no live price without a quote, its time or its time zone', () => {
  const quote: Quote = { symbol: 'AAPL', price: 103, change: 1, changePercent: 1, time: MIDDAY, timezone: 'America/New_York' }
  expect(livePriceOf(undefined)).toBeNull()
  expect(livePriceOf({ ...quote, time: undefined })).toBeNull()
  expect(livePriceOf({ ...quote, timezone: undefined })).toBeNull()
})

test('Should close the last bar at the live price and take its volume', () => {
  const data = history()
  expect(withLivePrice(data, live())).toEqual([data.bars[0], { ...data.bars[1], close: 103, volume: 6_000 }])
})

test('Should stretch the high or the low of the last bar when the live price goes beyond them', () => {
  const data = history()
  expect(withLivePrice(data, live({ price: 105 })).at(-1)).toMatchObject({ high: 105, low: 98, close: 105 })
  expect(withLivePrice(data, live({ price: 97 })).at(-1)).toMatchObject({ high: 104, low: 97, close: 97 })
})

test('Should never lower the volume of the last bar', () => {
  const data = history()
  expect(withLivePrice(data, live({ volume: 4_000 })).at(-1)?.volume).toBe(5_000)
  expect(withLivePrice(data, live({ volume: null })).at(-1)?.volume).toBe(5_000)
})

test('Should leave the bars alone when there is no live price', () => {
  const data = history()
  expect(withLivePrice(data, null)).toBe(data.bars)
})

test('Should leave the bars alone when the live price is of another symbol', () => {
  const data = history()
  expect(withLivePrice(data, live({ symbol: 'MSFT' }))).toBe(data.bars)
})

test('Should leave the bars alone when the live price is of another day than the last bar', () => {
  const data = history()
  expect(withLivePrice(data, live({ day: '2026-11-25' }))).toBe(data.bars)
  expect(withLivePrice(data, live({ day: '2026-11-23' }))).toBe(data.bars)
})

test('Should leave the bars alone when the history already has a trade as recent as the live price', () => {
  expect(withLivePrice(history({ tradedAt: MIDDAY }), live())).toHaveLength(2)
  const data = history({ tradedAt: MIDDAY })
  expect(withLivePrice(data, live())).toBe(data.bars)
  const newer = history({ tradedAt: MIDDAY + 1 })
  expect(withLivePrice(newer, live())).toBe(newer.bars)
})

test('Should use the live price when the history does not say when its last trade was', () => {
  expect(withLivePrice(history({ tradedAt: undefined }), live()).at(-1)?.close).toBe(103)
})

test('Should leave the bars alone when the live price changes nothing', () => {
  const data = history()
  expect(withLivePrice(data, live({ price: 102, volume: 5_000 }))).toBe(data.bars)
})

test('Should leave an empty history alone', () => {
  const data = history({ bars: [] })
  expect(withLivePrice(data, live())).toBe(data.bars)
})

test('Should not change the bars it was given', () => {
  const data = history()
  const before = JSON.stringify(data.bars)
  withLivePrice(data, live({ price: 110 }))
  expect(JSON.stringify(data.bars)).toBe(before)
})

const tracked = (over: Partial<Quote> = {}): Quote => ({
  symbol: 'AAPL',
  price: 101.5,
  change: 0.5,
  changePercent: (0.5 / 101) * 100,
  extended: null,
  time: MIDDAY - 20_000,
  timezone: 'America/New_York',
  volume: 4_000,
  ...over,
})

test('Should take the last trade of the history when it is newer than the quote', () => {
  const quote = withHistoryTrade(tracked(), history())
  expect(quote).toMatchObject({ price: 102, time: MIDDAY - 10_000, timezone: 'America/New_York', volume: 4_000, extended: null })
  expect(quote?.change).toBeCloseTo(1, 6)
  expect(quote?.changePercent).toBeCloseTo((1 / 101) * 100, 6)
})

test('Should keep the quote when it is as recent as the history', () => {
  const same = tracked({ time: MIDDAY - 10_000 })
  expect(withHistoryTrade(same, history())).toBe(same)
  const newer = tracked({ time: MIDDAY })
  expect(withHistoryTrade(newer, history())).toBe(newer)
})

test('Should keep the quote when the history is of another symbol or says nothing about its last trade', () => {
  const quote = tracked()
  expect(withHistoryTrade(quote, history({ info: { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ' } }))).toBe(quote)
  expect(withHistoryTrade(quote, history({ tradedAt: undefined }))).toBe(quote)
  expect(withHistoryTrade(quote, history({ bars: [] }))).toBe(quote)
  expect(withHistoryTrade(quote, null)).toBe(quote)
})

test('Should keep the quote when the last trade of the history is not of the day of its last bar', () => {
  const quote = tracked()
  expect(withHistoryTrade(quote, history({ tradedAt: MIDDAY + 86_400_000 }))).toBe(quote)
})

test('Should keep the quote when it does not say when it traded', () => {
  const untimed = tracked({ time: undefined })
  expect(withHistoryTrade(untimed, history())).toBe(untimed)
  expect(withHistoryTrade(undefined, history())).toBeUndefined()
})

test('Should measure against the last price of the day before when the history opens a new day', () => {
  const yesterday = tracked({ price: 101, change: 2, time: MIDDAY - 86_400_000 })
  const quote = withHistoryTrade(yesterday, history())
  expect(quote?.price).toBe(102)
  expect(quote?.change).toBeCloseTo(1, 6)
})

test('Should refresh only the quote of the symbol of the history among all the quotes', () => {
  const other = tracked({ symbol: 'KO' })
  const quotes = { AAPL: tracked(), KO: other }
  const fresh = freshQuotes(quotes, history())
  expect(fresh.AAPL.price).toBe(102)
  expect(fresh.KO).toBe(other)
})

test('Should give back the same quotes when the history has nothing newer', () => {
  const quotes = { AAPL: tracked({ time: MIDDAY }), KO: tracked({ symbol: 'KO' }) }
  expect(freshQuotes(quotes, history())).toBe(quotes)
  expect(freshQuotes(quotes, null)).toBe(quotes)
  expect(freshQuotes({}, history())).toEqual({})
})

const seenAfter = (prices: [number, number][], data: History = history()) =>
  prices.reduce<SeenTrades | null>((seen, [price, time]) => seeTrade(seen, data, live({ price, time })), null)

test('Should remember the trades it sees after the last trade of the history', () => {
  const seen = seenAfter([
    [103, MIDDAY],
    [106, MIDDAY + 1_000],
    [104, MIDDAY + 2_000],
  ])
  expect(seen).toEqual({
    symbol: 'AAPL',
    day: '2026-11-24',
    trades: [
      { time: MIDDAY, price: 103 },
      { time: MIDDAY + 1_000, price: 106 },
      { time: MIDDAY + 2_000, price: 104 },
    ],
  })
})

test('Should forget the trades that a newer history already covers', () => {
  const seen = seenAfter([
    [103, MIDDAY],
    [106, MIDDAY + 1_000],
    [104, MIDDAY + 2_000],
  ])
  const refreshed = history({ tradedAt: MIDDAY + 1_000 })
  expect(seeTrade(seen, refreshed, live({ price: 104, time: MIDDAY + 2_000 }))?.trades).toEqual([{ time: MIDDAY + 2_000, price: 104 }])
})

test('Should give back the same record when it sees nothing new', () => {
  const seen = seenAfter([[103, MIDDAY]])
  expect(seeTrade(seen, history(), live({ price: 103, time: MIDDAY }))).toBe(seen)
  const covered = seeTrade(seen, history({ tradedAt: MIDDAY + 5_000 }), live({ price: 103, time: MIDDAY }))
  expect(covered?.trades).toEqual([])
  expect(seeTrade(covered, history({ tradedAt: MIDDAY + 5_000 }), live({ price: 103, time: MIDDAY }))).toBe(covered)
})

test('Should start over when the live price is of another symbol or another day', () => {
  const seen = seenAfter([[103, MIDDAY]])
  const other = history({ info: { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ' } })
  expect(seeTrade(seen, other, live({ symbol: 'MSFT', price: 400, time: MIDDAY }))?.trades).toEqual([{ time: MIDDAY, price: 400 }])
  expect(seeTrade(seen, history(), live({ day: '2026-11-25' }))).toBeNull()
  expect(seeTrade(seen, history(), live({ symbol: 'MSFT' }))).toBeNull()
  expect(seeTrade(seen, history(), null)).toBeNull()
  expect(seeTrade(seen, null, live())).toBeNull()
})

test('Should remember at most three hundred trades', () => {
  const many = Array.from({ length: 320 }, (_, index): [number, number] => [100 + index, MIDDAY + index])
  const seen = seenAfter(many)
  expect(seen?.trades).toHaveLength(300)
  expect(seen?.trades[0]).toEqual({ time: MIDDAY + 20, price: 120 })
})

test('Should give the live price the highest and the lowest of the trades seen', () => {
  const seen = seenAfter([
    [103, MIDDAY],
    [106, MIDDAY + 1_000],
    [97, MIDDAY + 2_000],
    [104, MIDDAY + 3_000],
  ])
  expect(withSeenRange(live({ price: 104, time: MIDDAY + 3_000 }), seen)).toMatchObject({ price: 104, high: 106, low: 97 })
})

test('Should leave the live price alone when no trade was seen', () => {
  const price = live()
  expect(withSeenRange(price, null)).toBe(price)
  expect(withSeenRange(price, { symbol: 'AAPL', day: '2026-11-24', trades: [] })).toBe(price)
  expect(withSeenRange(null, seenAfter([[103, MIDDAY]]))).toBeNull()
})

test('Should keep in the last bar the high and the low the live price went through', () => {
  const data = history()
  expect(withLivePrice(data, live({ price: 103, high: 106, low: 97 })).at(-1)).toMatchObject({ high: 106, low: 97, close: 103 })
})

test('Should stretch the last bar when only the range of the live price is beyond it', () => {
  const data = history()
  expect(withLivePrice(data, live({ price: 102, volume: 5_000, high: 106 })).at(-1)).toMatchObject({ high: 106, close: 102 })
})

test('Should keep the highest and lowest trades that no longer fit in the record until the history covers them', () => {
  const swing = Array.from({ length: 330 }, (_, index): [number, number] => [index === 3 ? 140 : index === 5 ? 80 : 104, MIDDAY + index])
  const seen = seenAfter(swing)
  expect(seen?.trades).toHaveLength(300)
  expect(withSeenRange(live({ price: 104, time: MIDDAY + 329 }), seen)).toMatchObject({ high: 140, low: 80 })
  const covered = seeTrade(seen, history({ tradedAt: MIDDAY + 29 }), live({ price: 104, time: MIDDAY + 330 }))
  expect(withSeenRange(live({ price: 104, time: MIDDAY + 330 }), covered)).toMatchObject({ high: 104, low: 104 })
})
