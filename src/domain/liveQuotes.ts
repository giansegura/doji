import { dayInZone } from '../../shared/dates'
import type { ExtendedQuote, LiveTick, Quote } from '../../shared/types'

export type QuoteBook = {
  quotes: Record<string, Quote>
  tickedAt: Record<string, number>
  extendedAt: Record<string, number>
}

export const EMPTY_BOOK: QuoteBook = { quotes: {}, tickedAt: {}, extendedAt: {} }
export const LIVE_WINDOW_MS = 30_000

const EXTENDED_HOLD_MS = 30_000

const percentOf = (change: number, base: number): number => (base !== 0 ? (change / base) * 100 : 0)

const sameDay = (quote: Quote, time: number | undefined): boolean =>
  quote.timezone === undefined ||
  quote.time === undefined ||
  time === undefined ||
  dayInZone(quote.timezone, quote.time) === dayInZone(quote.timezone, time)

const withVolume = (volume: number | undefined): { volume?: number } => (volume === undefined ? {} : { volume })

const fromTick = (tick: LiveTick): Quote => ({
  symbol: tick.symbol,
  price: tick.price,
  change: tick.change,
  changePercent: tick.changePercent,
  extended: null,
  time: tick.time,
  ...withVolume(tick.volume ?? undefined),
})

const withRegularTick = (quote: Quote | undefined, tick: LiveTick): Quote => {
  if (!quote) return fromTick(tick)
  const today = sameDay(quote, tick.time)
  const previousClose = today ? quote.price - quote.change : quote.price
  const change = tick.price - previousClose
  const { volume: known, ...rest } = quote
  return {
    ...rest,
    price: tick.price,
    change,
    changePercent: percentOf(change, previousClose),
    extended: today && quote.extended?.session === 'post' ? quote.extended : null,
    time: tick.time,
    ...withVolume(tick.volume ?? (today ? known : undefined)),
  }
}

const withoutTick = (book: QuoteBook, symbol: string): QuoteBook => {
  if (!(symbol in book.tickedAt)) return book
  const { [symbol]: _gone, ...tickedAt } = book.tickedAt
  return { ...book, tickedAt }
}

const applyTick = (book: QuoteBook, tick: LiveTick, now: number): QuoteBook => {
  const quote = book.quotes[tick.symbol]
  const tickedAt = { ...book.tickedAt, [tick.symbol]: now }
  if (tick.session === 'regular') {
    if (quote?.time !== undefined && tick.time < quote.time) return book
    return { ...book, quotes: { ...book.quotes, [tick.symbol]: withRegularTick(quote, tick) }, tickedAt }
  }
  if (!quote || quote.extended?.session !== tick.session) return withoutTick(book, tick.symbol)
  const extended: ExtendedQuote = {
    session: tick.session,
    price: tick.price,
    changePercent: percentOf(tick.price - quote.price, quote.price),
  }
  return {
    quotes: { ...book.quotes, [tick.symbol]: { ...quote, extended } },
    tickedAt,
    extendedAt: { ...book.extendedAt, [tick.symbol]: now },
  }
}

const mergePolled = (current: Quote | undefined, polled: Quote, holdExtended: boolean): Quote => {
  if (!current) return polled
  const timezone = polled.timezone ?? current.timezone
  const zone = timezone === undefined ? {} : { timezone }
  const today = sameDay(current, polled.time)
  const older = current.time !== undefined && polled.time !== undefined && polled.time < current.time
  if (older && !today) return current
  if (older) {
    const previousClose = polled.price - polled.change
    const change = current.price - previousClose
    return { ...current, ...zone, change, changePercent: percentOf(change, previousClose) }
  }
  const ticked = holdExtended && polled.extended?.session === current.extended?.session ? current.extended : null
  const extended = ticked
    ? { ...ticked, changePercent: percentOf(ticked.price - polled.price, polled.price) }
    : (polled.extended ?? null)
  return { ...polled, ...zone, extended, ...withVolume(polled.volume ?? (today ? current.volume : undefined)) }
}

export const applyTicks = (book: QuoteBook, ticks: LiveTick[], now: number): QuoteBook =>
  ticks.reduce((current, tick) => applyTick(current, tick, now), book)

export const applyPolled = (book: QuoteBook, polled: Quote[], sentAt: number): QuoteBook => ({
  ...book,
  quotes: {
    ...book.quotes,
    ...Object.fromEntries(
      polled.map((quote) => {
        const tickedExtendedAt = book.extendedAt[quote.symbol] ?? Number.NEGATIVE_INFINITY
        return [quote.symbol, mergePolled(book.quotes[quote.symbol], quote, tickedExtendedAt > sentAt - EXTENDED_HOLD_MS)]
      }),
    ),
  },
})

const tickedLately = (book: QuoteBook, symbol: string, now: number): boolean =>
  now - (book.tickedAt[symbol] ?? Number.NEGATIVE_INFINITY) < LIVE_WINDOW_MS

export const quietSymbols = (book: QuoteBook, symbols: string[], now: number): string[] =>
  symbols.filter((symbol) => !tickedLately(book, symbol, now))

export const isLive = (book: QuoteBook, symbols: string[], now: number): boolean =>
  symbols.some((symbol) => tickedLately(book, symbol, now))
