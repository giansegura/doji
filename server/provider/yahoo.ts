import type { Bar, ExtendedQuote, ExtendedSession, History, Quote, Split, SymbolInfo } from '../../shared/types'

export type ProviderErrorKind = 'not_found' | 'rate_limited' | 'unavailable'

export type ProviderError = Error & { kind: ProviderErrorKind }

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ status: number; json: () => Promise<unknown> }>

export type DataProvider = {
  history: (symbol: string, fromDate?: string) => Promise<History>
  search: (query: string) => Promise<SymbolInfo[]>
  quotes: (symbols: string[]) => Promise<Quote[]>
  logoUrl: (symbol: string) => Promise<string | null>
}

type Json = Record<string, unknown>

export const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0' }

const RETRY_DELAY_MS = 1500
const COOLDOWN_MS = 60_000
const QUOTES_BATCH = 20
const FULL_HISTORY_START = -2208988800
const SEARCHABLE_TYPES = ['EQUITY', 'ETF', 'CURRENCY']
const FOREX_EXCHANGE = 'CCY'
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const SPARK_URL = 'https://query1.finance.yahoo.com/v7/finance/spark'
const SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search'

export const providerError = (kind: ProviderErrorKind, message: string): ProviderError =>
  Object.assign(new Error(message), { kind })

export const isProviderError = (error: unknown): error is ProviderError =>
  error instanceof Error && typeof (error as { kind?: unknown }).kind === 'string'

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const asString = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null)

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const byDate = <T>(dateOf: (item: T) => string) => (a: T, b: T): number => dateOf(a).localeCompare(dateOf(b))

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' } as const
  try {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone })
  } catch {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' })
  }
}

const tradeTimeOf = (meta: Json): number | null => {
  const seconds = asNumber(meta.regularMarketTime)
  return seconds !== null && seconds > 0 ? seconds * 1000 : null
}

const marketName = (raw: string): string => (raw === FOREX_EXCHANGE ? 'Forex' : raw)

const exchangeName = (meta: Json): string => {
  const full = asString(meta.fullExchangeName) ?? asString(meta.exchangeName) ?? ''
  return full.startsWith('Nasdaq') ? 'NASDAQ' : marketName(full)
}

const lastPriceOn = (meta: Json, toDate: (seconds: number) => string): { day: string; price: number } | null => {
  const seconds = asNumber(meta.regularMarketTime)
  const price = asNumber(meta.regularMarketPrice)
  return seconds !== null && seconds > 0 && price !== null ? { day: toDate(seconds), price } : null
}

const parseBars = (result: Json, toDate: (seconds: number) => string): Bar[] => {
  const quote = asObject(asArray(asObject(result.indicators).quote)[0])
  const timestamps = asArray(result.timestamp)
  const lastPrice = lastPriceOn(asObject(result.meta), toDate)
  const opens = asArray(quote.open)
  const highs = asArray(quote.high)
  const lows = asArray(quote.low)
  const closes = asArray(quote.close)
  const volumes = asArray(quote.volume)
  const bars = new Map<string, Bar>()
  timestamps.forEach((timestamp, index) => {
    const seconds = asNumber(timestamp)
    const open = asNumber(opens[index])
    const high = asNumber(highs[index])
    const low = asNumber(lows[index])
    if (seconds === null || open === null || high === null || low === null) return
    const time = toDate(seconds)
    const unfilled = index === timestamps.length - 1 && lastPrice?.day === time ? lastPrice.price : null
    const close = asNumber(closes[index]) ?? unfilled
    if (close === null) return
    bars.set(time, { time, open, high, low, close, volume: asNumber(volumes[index]) ?? 0 })
  })
  return [...bars.values()].sort(byDate((bar) => bar.time))
}

const parseSplits = (result: Json, toDate: (seconds: number) => string): Split[] =>
  Object.values(asObject(asObject(result.events).splits))
    .map((raw): Split | null => {
      const split = asObject(raw)
      const seconds = asNumber(split.date)
      const numerator = asNumber(split.numerator)
      const denominator = asNumber(split.denominator)
      if (seconds === null || !numerator || !denominator) return null
      return { date: toDate(seconds), numerator, denominator }
    })
    .filter((split): split is Split => split !== null)
    .sort(byDate((split) => split.date))

export const parseHistory = (json: unknown, fetchedAt: string): History => {
  const result = asObject(asArray(asObject(asObject(json).chart).result)[0])
  const meta = asObject(result.meta)
  const symbol = asString(meta.symbol)
  if (!symbol) throw providerError('not_found', 'Yahoo returned no data for the symbol')

  const formatter = formatterFor(asString(meta.exchangeTimezoneName) ?? 'UTC')
  const toDate = (seconds: number): string => formatter.format(new Date(seconds * 1000))
  const tradedAt = tradeTimeOf(meta)
  return {
    info: {
      symbol,
      name: asString(meta.longName) ?? asString(meta.shortName) ?? symbol,
      exchange: exchangeName(meta),
    },
    bars: parseBars(result, toDate),
    splits: parseSplits(result, toDate),
    fetchedAt,
    stale: false,
    ...(tradedAt === null ? {} : { tradedAt }),
  }
}

export const parseSearch = (json: unknown): SymbolInfo[] =>
  asArray(asObject(json).quotes)
    .map((raw): SymbolInfo | null => {
      const quote = asObject(raw)
      const symbol = asString(quote.symbol)
      if (!symbol || !SEARCHABLE_TYPES.includes(asString(quote.quoteType) ?? '')) return null
      return {
        symbol,
        name: asString(quote.longname) ?? asString(quote.shortname) ?? symbol,
        exchange: marketName(asString(quote.exchDisp) ?? asString(quote.exchange) ?? ''),
      }
    })
    .filter((result): result is SymbolInfo => result !== null)

export const parseLogoUrl = (json: unknown, symbol: string): string | null => {
  const match = asArray(asObject(json).quotes)
    .map(asObject)
    .find((quote) => asString(quote.symbol)?.toUpperCase() === symbol.toUpperCase())
  return asString(match?.logoUrl) ?? null
}

type Period = { start: number; end: number }

const toPeriod = (raw: unknown): Period | null => {
  const period = asObject(raw)
  const start = asNumber(period.start)
  const end = asNumber(period.end)
  return start !== null && end !== null ? { start, end } : null
}

const sessionAt = (seconds: number, periods: unknown): ExtendedSession | null => {
  const current = asObject(periods)
  const regular = toPeriod(current.regular)
  const pre = toPeriod(current.pre)
  if (!regular || (seconds >= regular.start && seconds < regular.end)) return null
  return pre && seconds >= pre.start && seconds < regular.start ? 'pre' : 'post'
}

const toExtended = (meta: Record<string, unknown>, price: number, now: Date): ExtendedQuote | null => {
  const extendedPrice = asNumber(meta.fulldayPrice)
  const session = sessionAt(now.getTime() / 1000, meta.currentTradingPeriod)
  if (meta.hasPrePostMarketData !== true || extendedPrice === null || !session) return null
  return { session, price: extendedPrice, changePercent: ((extendedPrice - price) / price) * 100 }
}

export const parseQuotes = (json: unknown, now: Date): Quote[] =>
  asArray(asObject(asObject(json).spark).result)
    .map((raw): Quote | null => {
      const item = asObject(raw)
      const meta = asObject(asObject(asArray(item.response)[0]).meta)
      const symbol = asString(item.symbol) ?? asString(meta.symbol)
      const price = asNumber(meta.regularMarketPrice)
      const previousClose = asNumber(meta.chartPreviousClose) ?? asNumber(meta.previousClose)
      if (!symbol || price === null || !previousClose) return null
      const change = price - previousClose
      const time = tradeTimeOf(meta)
      const timezone = asString(meta.exchangeTimezoneName)
      return {
        symbol,
        price,
        change,
        changePercent: (change / previousClose) * 100,
        extended: toExtended(meta, price, now),
        ...(time === null ? {} : { time }),
        ...(timezone === null ? {} : { timezone }),
      }
    })
    .filter((quote): quote is Quote => quote !== null)

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

export const createYahooProvider = (deps: {
  fetch: FetchLike
  sleep: (ms: number) => Promise<void>
  now: () => Date
}): DataProvider => {
  const attempt = async (url: string) => {
    try {
      return await deps.fetch(url, { headers: YAHOO_HEADERS })
    } catch {
      throw providerError('unavailable', 'No connection to Yahoo')
    }
  }

  let blockedUntil = 0

  const request = async (url: string): Promise<unknown> => {
    if (deps.now().getTime() < blockedUntil) throw providerError('rate_limited', 'Yahoo sigue en pausa por exceso de uso')
    const first = await attempt(url)
    const response = first.status === 429 ? await deps.sleep(RETRY_DELAY_MS).then(() => attempt(url)) : first
    if (response.status === 429) {
      blockedUntil = deps.now().getTime() + COOLDOWN_MS
      throw providerError('rate_limited', 'Yahoo rejected the request for excessive use')
    }
    if (response.status === 404) throw providerError('not_found', 'Yahoo does not know the symbol')
    if (response.status !== 200) throw providerError('unavailable', `Yahoo answered ${response.status}`)
    try {
      return await response.json()
    } catch {
      throw providerError('unavailable', 'Yahoo returned an unreadable answer')
    }
  }

  const history = async (symbol: string, fromDate?: string): Promise<History> => {
    const now = deps.now()
    const period1 = fromDate ? Date.parse(`${fromDate}T00:00:00Z`) / 1000 : FULL_HISTORY_START
    const period2 = Math.floor(now.getTime() / 1000)
    const url = `${CHART_URL}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=splits`
    return parseHistory(await request(url), now.toISOString())
  }

  const search = async (query: string): Promise<SymbolInfo[]> => {
    const text = query.trim()
    if (!text) return []
    return parseSearch(await request(`${SEARCH_URL}?q=${encodeURIComponent(text)}&quotesCount=10&newsCount=0`))
  }

  const quotes = async (symbols: string[]): Promise<Quote[]> => {
    const out: Quote[] = []
    for (const batch of chunk(symbols, QUOTES_BATCH)) {
      const list = batch.map(encodeURIComponent).join(',')
      out.push(...parseQuotes(await request(`${SPARK_URL}?symbols=${list}&range=1d&interval=1d`), deps.now()))
    }
    return out
  }

  const logoUrl = async (symbol: string): Promise<string | null> =>
    parseLogoUrl(
      await request(`${SEARCH_URL}?q=${encodeURIComponent(symbol)}&quotesCount=10&newsCount=0&enableLogoUrl=true`),
      symbol,
    )

  return { history, search, quotes, logoUrl }
}
