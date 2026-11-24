import { expect, test } from 'vitest'
import type { LiveTick, Quote } from '../../shared/types'
import { EMPTY_BOOK, type QuoteBook, applyPolled, applyTicks, isLive, quietSymbols } from './liveQuotes'

const YESTERDAY_CLOSE = Date.parse('2026-11-23T21:00:00Z')
const TODAY_OPEN = Date.parse('2026-11-24T14:30:00Z')
const MIDDAY = Date.parse('2026-11-24T17:00:00Z')
const TODAY_CLOSE = Date.parse('2026-11-24T21:00:00Z')
const NOW = 1_000_000

const quote = (over: Partial<Quote> = {}): Quote => ({
  symbol: 'AAPL',
  price: 350,
  change: 0.92,
  changePercent: (0.92 / 349.08) * 100,
  extended: null,
  time: MIDDAY,
  timezone: 'America/New_York',
  ...over,
})

const tick = (over: Partial<LiveTick> = {}): LiveTick => ({
  symbol: 'AAPL',
  price: 351.08,
  change: 9,
  changePercent: 9,
  time: MIDDAY + 5_000,
  session: 'regular',
  volume: 1_000,
  ...over,
})

const bookOf = (quotes: Quote[], over: Partial<QuoteBook> = {}): QuoteBook => ({
  ...EMPTY_BOOK,
  quotes: Object.fromEntries(quotes.map((item) => [item.symbol, item])),
  ...over,
})

test('Should move the price with a tick and measure its change against the previous close of the quote', () => {
  const { quotes } = applyTicks(bookOf([quote()]), [tick()], NOW)
  expect(quotes.AAPL.price).toBe(351.08)
  expect(quotes.AAPL.change).toBeCloseTo(2, 6)
  expect(quotes.AAPL.changePercent).toBeCloseTo((2 / 349.08) * 100, 6)
  expect(quotes.AAPL).toMatchObject({ time: MIDDAY + 5_000, timezone: 'America/New_York', volume: 1_000, extended: null })
})

test('Should ignore a tick older than the price it already has', () => {
  const book = applyTicks(bookOf([quote()]), [tick({ time: MIDDAY - 1 })], NOW)
  expect(book.quotes.AAPL).toEqual(quote())
  expect(isLive(book, ['AAPL'], NOW)).toBe(false)
})

test('Should measure the first price of a new day against the last price of the day before', () => {
  const closed = quote({ price: 349.08, change: 6.52, changePercent: 1.9, time: YESTERDAY_CLOSE })
  const { quotes } = applyTicks(bookOf([closed]), [tick({ price: 352.57, time: TODAY_OPEN })], NOW)
  expect(quotes.AAPL.change).toBeCloseTo(3.49, 6)
  expect(quotes.AAPL.changePercent).toBeCloseTo((3.49 / 349.08) * 100, 6)
})

test('Should keep measuring against that close for the rest of the day', () => {
  const closed = quote({ price: 349.08, change: 6.52, changePercent: 1.9, time: YESTERDAY_CLOSE })
  const opened = applyTicks(bookOf([closed]), [tick({ price: 352.57, time: TODAY_OPEN })], NOW)
  const { quotes } = applyTicks(opened, [tick({ price: 350.08, time: TODAY_OPEN + 60_000 })], NOW)
  expect(quotes.AAPL.change).toBeCloseTo(1, 6)
})

test('Should take the change a tick brings when it has no quote to measure against', () => {
  const { quotes } = applyTicks(EMPTY_BOOK, [tick()], NOW)
  expect(quotes.AAPL).toEqual({
    symbol: 'AAPL',
    price: 351.08,
    change: 9,
    changePercent: 9,
    extended: null,
    time: MIDDAY + 5_000,
    volume: 1_000,
  })
})

test('Should apply the ticks of a batch in order', () => {
  const { quotes } = applyTicks(bookOf([quote()]), [tick({ price: 351 }), tick({ price: 352, time: MIDDAY + 6_000 })], NOW)
  expect(quotes.AAPL.price).toBe(352)
})

test('Should keep the volume of the day when a tick brings none, and forget it on a new day', () => {
  const withVolume = applyTicks(bookOf([quote()]), [tick()], NOW)
  const sameDay = applyTicks(withVolume, [tick({ time: MIDDAY + 6_000, volume: null })], NOW)
  expect(sameDay.quotes.AAPL.volume).toBe(1_000)
  const nextDay = applyTicks(sameDay, [tick({ time: MIDDAY + 86_400_000, volume: null })], NOW)
  expect(nextDay.quotes.AAPL.volume).toBeUndefined()
})

test('Should end the pre-market reading with the first regular tick', () => {
  const before = quote({ time: YESTERDAY_CLOSE, extended: { session: 'pre', price: 352, changePercent: 0.57 } })
  expect(applyTicks(bookOf([before]), [tick({ time: TODAY_OPEN })], NOW).quotes.AAPL.extended).toBeNull()
})

test('Should keep the after-hours reading when a late regular tick arrives', () => {
  const after = { session: 'post' as const, price: 352, changePercent: 0.57 }
  const closed = quote({ time: TODAY_CLOSE - 1_000, extended: after })
  expect(applyTicks(bookOf([closed]), [tick({ time: TODAY_CLOSE })], NOW).quotes.AAPL.extended).toEqual(after)
})

test('Should move the extended price with a tick of the session the quote already shows', () => {
  const closed = quote({ price: 350, time: TODAY_CLOSE, extended: { session: 'post', price: 351, changePercent: 0.29 } })
  const book = applyTicks(bookOf([closed]), [tick({ session: 'post', price: 353.5, time: TODAY_CLOSE + 60_000 })], NOW)
  expect(book.quotes.AAPL.extended).toEqual({ session: 'post', price: 353.5, changePercent: 1 })
  expect(book.quotes.AAPL).toMatchObject({ price: 350, time: TODAY_CLOSE })
  expect(isLive(book, ['AAPL'], NOW)).toBe(true)
})

test('Should wait for the quote to confirm a session before trusting its ticks', () => {
  const book = applyTicks(bookOf([quote()], { tickedAt: { AAPL: NOW - 1_000 } }), [tick({ session: 'post', price: 353.5 })], NOW)
  expect(book.quotes.AAPL).toEqual(quote())
  expect(quietSymbols(book, ['AAPL'], NOW)).toEqual(['AAPL'])
})

test('Should ignore an extended tick for a symbol it has no quote of', () => {
  expect(applyTicks(EMPTY_BOOK, [tick({ session: 'pre' })], NOW).quotes).toEqual({})
})

test('Should take a polled quote of a symbol it did not know', () => {
  expect(applyPolled(EMPTY_BOOK, [quote()], NOW).quotes.AAPL).toEqual(quote())
})

test('Should take a polled price that is newer than the one it has', () => {
  const ticked = applyTicks(bookOf([quote()]), [tick()], NOW)
  const polled = quote({ price: 352, change: 2.92, changePercent: 0.84, time: MIDDAY + 9_000 })
  expect(applyPolled(ticked, [polled], NOW).quotes.AAPL).toMatchObject({ price: 352, change: 2.92, time: MIDDAY + 9_000, volume: 1_000 })
})

test('Should not let a polled price older than the last tick move the price back', () => {
  const ticked = applyTicks(bookOf([quote()]), [tick()], NOW)
  const { quotes } = applyPolled(ticked, [quote({ price: 350.5, change: 1.42, time: MIDDAY + 2_000 })], NOW)
  expect(quotes.AAPL).toMatchObject({ price: 351.08, time: MIDDAY + 5_000 })
  expect(quotes.AAPL.change).toBeCloseTo(2, 6)
})

test('Should measure against the previous close of an older polled quote of the same day', () => {
  const ticked = applyTicks(bookOf([quote()]), [tick()], NOW)
  const { quotes } = applyPolled(ticked, [quote({ price: 350.5, change: 0.5, time: MIDDAY + 2_000 })], NOW)
  expect(quotes.AAPL.price).toBe(351.08)
  expect(quotes.AAPL.change).toBeCloseTo(1.08, 6)
  expect(quotes.AAPL.changePercent).toBeCloseTo((1.08 / 350) * 100, 6)
})

test('Should change nothing with a polled quote from the day before', () => {
  const closed = quote({ price: 349.08, change: 6.52, changePercent: 1.9, time: YESTERDAY_CLOSE, extended: { session: 'pre', price: 352, changePercent: 0.84 } })
  const opened = applyTicks(bookOf([closed]), [tick({ price: 352.57, time: TODAY_OPEN })], NOW)
  const { quotes } = applyPolled(opened, [closed], NOW)
  expect(quotes.AAPL).toEqual(opened.quotes.AAPL)
  expect(quotes.AAPL.extended).toBeNull()
})

test('Should take the extended reading of a polled quote', () => {
  const after = { session: 'post' as const, price: 351, changePercent: 0.29 }
  const { quotes } = applyPolled(bookOf([quote()]), [quote({ time: TODAY_CLOSE, extended: after })], NOW)
  expect(quotes.AAPL.extended).toEqual(after)
})

test('Should keep the extended price of a tick that arrived around the time the poll was sent', () => {
  const closed = quote({ time: TODAY_CLOSE, extended: { session: 'post', price: 351, changePercent: 0.29 } })
  const ticked = applyTicks(bookOf([closed]), [tick({ session: 'post', price: 353.5, time: TODAY_CLOSE + 60_000 })], NOW)
  const { quotes } = applyPolled(ticked, [closed], NOW + 20_000)
  expect(quotes.AAPL.extended).toEqual({ session: 'post', price: 353.5, changePercent: 1 })
})

test('Should take the extended price of the poll when the last extended tick is old', () => {
  const closed = quote({ time: TODAY_CLOSE, extended: { session: 'post', price: 351, changePercent: 0.29 } })
  const ticked = applyTicks(bookOf([closed]), [tick({ session: 'post', price: 353.5, time: TODAY_CLOSE + 60_000 })], NOW)
  const { quotes } = applyPolled(ticked, [closed], NOW + 31_000)
  expect(quotes.AAPL.extended).toEqual({ session: 'post', price: 351, changePercent: 0.29 })
})

test('Should drop the extended reading when the poll says the session is over', () => {
  const closed = quote({ time: TODAY_CLOSE, extended: { session: 'post', price: 351, changePercent: 0.29 } })
  const ticked = applyTicks(bookOf([closed]), [tick({ session: 'post', price: 353.5, time: TODAY_CLOSE + 60_000 })], NOW)
  expect(applyPolled(ticked, [quote({ time: TODAY_CLOSE, extended: null })], NOW).quotes.AAPL.extended).toBeNull()
})

test('Should keep the time zone it knows when a polled quote brings none', () => {
  const { quotes } = applyPolled(bookOf([quote()]), [quote({ time: MIDDAY + 1_000, timezone: undefined })], NOW)
  expect(quotes.AAPL.timezone).toBe('America/New_York')
})

test('Should replace a quote without times with whatever is polled', () => {
  const plain: Quote = { symbol: 'AAPL', price: 10, change: 1, changePercent: 1 }
  expect(applyPolled(bookOf([plain]), [{ ...plain, price: 11 }], NOW).quotes.AAPL.price).toBe(11)
})

test('Should keep the quotes that a poll leaves out', () => {
  const other = quote({ symbol: 'KO' })
  expect(Object.keys(applyPolled(bookOf([quote(), other]), [quote()], NOW).quotes)).toEqual(['AAPL', 'KO'])
})

test('Should call quiet the symbols without a tick in the last thirty seconds', () => {
  const book = bookOf([], { tickedAt: { AAPL: NOW - 29_999, MSFT: NOW - 30_000 } })
  expect(quietSymbols(book, ['AAPL', 'MSFT', 'KO'], NOW)).toEqual(['MSFT', 'KO'])
})

test('Should say prices are live while any of the symbols ticked in the last thirty seconds', () => {
  const book = bookOf([], { tickedAt: { AAPL: NOW - 29_999, MSFT: NOW - 30_000 } })
  expect(isLive(book, ['AAPL', 'KO'], NOW)).toBe(true)
  expect(isLive(book, ['MSFT', 'KO'], NOW)).toBe(false)
  expect(isLive(EMPTY_BOOK, ['AAPL'], NOW)).toBe(false)
})

test('Should drop the after-hours reading of the day before with the first regular tick of a new day', () => {
  const yesterday = quote({ time: YESTERDAY_CLOSE, extended: { session: 'post', price: 352, changePercent: 0.84 } })
  expect(applyTicks(bookOf([yesterday]), [tick({ time: TODAY_OPEN })], NOW).quotes.AAPL.extended).toBeNull()
})

test('Should take the volume a newer poll of the same day brings', () => {
  const ticked = applyTicks(bookOf([quote()]), [tick()], NOW)
  const polled = quote({ price: 352, time: MIDDAY + 9_000, volume: 2_500 })
  expect(applyPolled(ticked, [polled], NOW).quotes.AAPL.volume).toBe(2_500)
})

test('Should keep the volume it has when a newer poll of the same day brings none', () => {
  const ticked = applyTicks(bookOf([quote()]), [tick()], NOW)
  expect(applyPolled(ticked, [quote({ price: 352, time: MIDDAY + 9_000 })], NOW).quotes.AAPL.volume).toBe(1_000)
})
