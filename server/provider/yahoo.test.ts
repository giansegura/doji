import { expect, test } from 'vitest'
import aaplSplit from './__fixtures__/chart-aapl-split.json'
import searchApple from './__fixtures__/search-apple.json'
import spark from './__fixtures__/spark.json'
import {
  type FetchLike,
  createYahooProvider,
  isProviderError,
  parseHistory,
  parseLogoUrl,
  parseQuotes,
  parseSearch,
} from './yahoo'

const chartJson = (over: object = {}) => ({
  chart: {
    error: null,
    result: [
      {
        meta: {
          symbol: 'TEST',
          longName: 'Test Corp',
          fullExchangeName: 'NasdaqGS',
          exchangeTimezoneName: 'America/New_York',
        },
        timestamp: [1795098600, 1795185000, 1795444200, 1795480200],
        indicators: {
          quote: [
            {
              open: [null, 10, 11, 11],
              high: [null, 12, 13, 14],
              low: [null, 9, 10, 10],
              close: [null, 11, 12, 13.5],
              volume: [null, 100, 200, 250],
            },
          ],
        },
        events: { splits: { '1598880600': { date: 1598880600, numerator: 4, denominator: 1, splitRatio: '4:1' } } },
        ...over,
      },
    ],
  },
})

type FakeResponse = { status: number; body?: unknown } | 'network-error'

const makeProvider = (responses: FakeResponse[]) => {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const sleeps: number[] = []
  const fetch: FetchLike = async (url, init) => {
    const response = responses[Math.min(calls.length, responses.length - 1)]
    calls.push({ url, headers: init.headers })
    if (response === 'network-error') throw new Error('ECONNRESET')
    return { status: response.status, json: async () => response.body }
  }
  const provider = createYahooProvider({
    fetch,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    now: () => new Date('2026-11-23T20:00:00Z'),
  })
  return { provider, calls, sleeps }
}

const kindOf = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise
    return 'resolved'
  } catch (error) {
    return isProviderError(error) ? error.kind : 'other-error'
  }
}

test('Should drop null bars and keep the last bar of a repeated date', () => {
  const history = parseHistory(chartJson(), '2026-11-23T20:00:00.000Z')
  expect(history.bars).toEqual([
    { time: '2026-11-20', open: 10, high: 12, low: 9, close: 11, volume: 100 },
    { time: '2026-11-23', open: 11, high: 14, low: 10, close: 13.5, volume: 250 },
  ])
  expect(history.fetchedAt).toBe('2026-11-23T20:00:00.000Z')
})

test('Should date bars in the exchange time zone', () => {
  const tokyo = chartJson({
    meta: { symbol: 'T', exchangeTimezoneName: 'Asia/Tokyo' },
    timestamp: [1795392000],
    indicators: { quote: [{ open: [1], high: [1], low: [1], close: [1], volume: [1] }] },
  })
  expect(parseHistory(tokyo, 'x').bars[0].time).toBe('2026-11-23')
  const newYork = chartJson({
    timestamp: [1795392000],
    indicators: { quote: [{ open: [1], high: [1], low: [1], close: [1], volume: [1] }] },
  })
  expect(parseHistory(newYork, 'x').bars[0].time).toBe('2026-11-22')
})

test('Should sort bars that arrive out of order', () => {
  const shuffled = chartJson({
    timestamp: [1795444200, 1795185000],
    indicators: { quote: [{ open: [2, 1], high: [2, 1], low: [2, 1], close: [2, 1], volume: [2, 1] }] },
  })
  expect(parseHistory(shuffled, 'x').bars.map((bar) => bar.time)).toEqual(['2026-11-20', '2026-11-23'])
})

test('Should read symbol info and splits', () => {
  const history = parseHistory(chartJson(), 'x')
  expect(history.info).toEqual({ symbol: 'TEST', name: 'Test Corp', exchange: 'NASDAQ' })
  expect(history.splits).toEqual([{ date: '2020-08-31', numerator: 4, denominator: 1 }])
  expect(history.stale).toBe(false)
})

test('Should fall back to the short name and keep other exchange names', () => {
  const json = chartJson({
    meta: { symbol: 'IBM', shortName: 'IBM Corp', fullExchangeName: 'NYSE', exchangeTimezoneName: 'America/New_York' },
  })
  expect(parseHistory(json, 'x').info).toEqual({ symbol: 'IBM', name: 'IBM Corp', exchange: 'NYSE' })
})

test('Should throw not_found when Yahoo reports an error', () => {
  const json = { chart: { result: null, error: { code: 'Not Found', description: 'No data found' } } }
  expect(() => parseHistory(json, 'x')).toThrowError(expect.objectContaining({ kind: 'not_found' }))
})

test('Should throw not_found for a response without the expected shape', () => {
  expect(() => parseHistory(null, 'x')).toThrowError(expect.objectContaining({ kind: 'not_found' }))
  expect(() => parseHistory({ chart: {} }, 'x')).toThrowError(expect.objectContaining({ kind: 'not_found' }))
})

test('Should treat a missing volume as zero and tolerate missing events', () => {
  const json = chartJson({
    events: undefined,
    timestamp: [1795185000],
    indicators: { quote: [{ open: [10], high: [12], low: [9], close: [11], volume: [null] }] },
  })
  const history = parseHistory(json, 'x')
  expect(history.splits).toEqual([])
  expect(history.bars).toEqual([{ time: '2026-11-20', open: 10, high: 12, low: 9, close: 11, volume: 0 }])
})

test('Should return no bars when Yahoo sends no timestamps', () => {
  const json = chartJson({ timestamp: undefined, indicators: { quote: [{}] } })
  expect(parseHistory(json, 'x').bars).toEqual([])
})

test('Should parse a real chart response', () => {
  const history = parseHistory(aaplSplit, 'x')
  const times = history.bars.map((bar) => bar.time)
  expect(history.info.symbol).toBe('AAPL')
  expect(history.info.exchange).toBe('NASDAQ')
  expect(history.bars.length).toBeGreaterThan(20)
  expect(times).toEqual([...new Set(times)].sort())
  expect(times[0]).toBe('2020-08-03')
  expect(history.splits).toEqual([{ date: '2020-08-31', numerator: 4, denominator: 1 }])
})

test('Should keep only stocks and ETFs from a search', () => {
  const json = {
    quotes: [
      { symbol: 'AAPL', quoteType: 'EQUITY', longname: 'Apple Inc.', shortname: 'Apple', exchDisp: 'NASDAQ', exchange: 'NMS' },
      { symbol: 'SAAPL=F', quoteType: 'FUTURE', shortname: 'Apple futures', exchDisp: 'CME' },
      { symbol: 'SPY', quoteType: 'ETF', shortname: 'SPDR S&P 500', exchange: 'PCX' },
      { quoteType: 'EQUITY', shortname: 'sin símbolo' },
    ],
  }
  expect(parseSearch(json)).toEqual([
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    { symbol: 'SPY', name: 'SPDR S&P 500', exchange: 'PCX' },
  ])
})

test('Should return no search results for an unexpected response', () => {
  expect(parseSearch(null)).toEqual([])
  expect(parseSearch({ quotes: 'x' })).toEqual([])
})

test('Should parse a real search response', () => {
  const out = parseSearch(searchApple)
  expect(out[0]).toEqual({ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' })
  expect(out.map((result) => result.symbol)).not.toContain('SAAPL=F')
  expect(out.every((result) => result.name.length > 0 && result.exchange.length > 0)).toBe(true)
})

test('Should read the logo address of the exact symbol', () => {
  const json = {
    quotes: [
      { symbol: 'AAPU', logoUrl: 'https://s.yimg.com/lb/brands/150x150_other.png' },
      { symbol: 'AAPL', logoUrl: 'https://s.yimg.com/lb/brands/150x150_apple.png' },
    ],
  }
  expect(parseLogoUrl(json, 'aapl')).toBe('https://s.yimg.com/lb/brands/150x150_apple.png')
})

test('Should have no logo address when the symbol has none or is not listed', () => {
  const json = { quotes: [{ symbol: 'KO' }, { symbol: 'AAPL', logoUrl: 'https://s.yimg.com/lb/brands/150x150_apple.png' }] }
  expect(parseLogoUrl(json, 'KO')).toBe(null)
  expect(parseLogoUrl(json, 'MSFT')).toBe(null)
  expect(parseLogoUrl(null, 'KO')).toBe(null)
})

test('Should ask Yahoo for the logo address through the search', async () => {
  const body = { quotes: [{ symbol: 'BRK-B', logoUrl: 'https://s.yimg.com/lb/brands/150x150_brk.png' }] }
  const { provider, calls } = makeProvider([{ status: 200, body }])
  expect(await provider.logoUrl('BRK-B')).toBe('https://s.yimg.com/lb/brands/150x150_brk.png')
  expect(calls[0].url).toBe(
    'https://query2.finance.yahoo.com/v1/finance/search?q=BRK-B&quotesCount=10&newsCount=0&enableLogoUrl=true',
  )
})

test('Should compute change from the previous close and skip incomplete quotes', () => {
  const json = {
    spark: {
      result: [
        { symbol: 'AAA', response: [{ meta: { symbol: 'AAA', regularMarketPrice: 110, chartPreviousClose: 100 } }] },
        { symbol: 'BBB', response: [{ meta: { symbol: 'BBB', regularMarketPrice: 50 } }] },
        { symbol: 'CCC', response: [] },
      ],
    },
  }
  expect(parseQuotes(json, new Date(0))).toEqual([
    { symbol: 'AAA', price: 110, change: 10, changePercent: 10, extended: null },
  ])
  expect(parseQuotes({}, new Date(0))).toEqual([])
})

test('Should parse real batch quotes including a dashed symbol', () => {
  const out = parseQuotes(spark, new Date(0))
  expect(out.map((quote) => quote.symbol).sort()).toEqual(['AAPL', 'BRK-B', 'MSFT'])
  out.forEach((quote) => {
    expect(quote.price).toBeGreaterThan(0)
    expect(quote.changePercent).toBeCloseTo((quote.change / (quote.price - quote.change)) * 100, 6)
  })
})

test('Should request full daily history with the accepted user agent', async () => {
  const { provider, calls } = makeProvider([{ status: 200, body: chartJson() }])
  const history = await provider.history('BRK-B')
  expect(calls).toHaveLength(1)
  expect(calls[0].url).toBe(
    'https://query1.finance.yahoo.com/v8/finance/chart/BRK-B?period1=-2208988800&period2=1795464000&interval=1d&events=splits',
  )
  expect(calls[0].headers).toEqual({ 'User-Agent': 'Mozilla/5.0' })
  expect(history.fetchedAt).toBe('2026-11-23T20:00:00.000Z')
})

test('Should encode symbols in the URL', async () => {
  const { provider, calls } = makeProvider([{ status: 200, body: chartJson() }])
  await provider.history('^GSPC')
  expect(calls[0].url).toContain('/chart/%5EGSPC?')
})

test('Should start a tail request at the given date', async () => {
  const { provider, calls } = makeProvider([{ status: 200, body: chartJson() }])
  await provider.history('AAPL', '2026-11-13')
  expect(calls[0].url).toContain('period1=1794528000&')
})

test('Should retry once after a 429 and then succeed', async () => {
  const { provider, calls, sleeps } = makeProvider([{ status: 429 }, { status: 200, body: chartJson() }])
  const history = await provider.history('AAPL')
  expect(history.bars).toHaveLength(2)
  expect(calls).toHaveLength(2)
  expect(sleeps).toEqual([1500])
})

test('Should fail as rate_limited after two 429', async () => {
  const { provider, calls } = makeProvider([{ status: 429 }])
  expect(await kindOf(provider.history('AAPL'))).toBe('rate_limited')
  expect(calls).toHaveLength(2)
})

test('Should leave Yahoo alone for a minute after being rate limited', async () => {
  let clock = Date.parse('2026-11-23T20:00:00Z')
  let requests = 0
  const provider = createYahooProvider({
    fetch: async () => {
      requests += 1
      return { status: 429, json: async () => null }
    },
    sleep: async () => {},
    now: () => new Date(clock),
  })
  expect(await kindOf(provider.history('AAPL'))).toBe('rate_limited')
  expect(requests).toBe(2)
  expect(await kindOf(provider.quotes(['AAPL']))).toBe('rate_limited')
  expect(await kindOf(provider.search('apple'))).toBe('rate_limited')
  expect(requests).toBe(2)
  clock += 61_000
  expect(await kindOf(provider.history('AAPL'))).toBe('rate_limited')
  expect(requests).toBe(4)
})

test('Should keep asking after an ordinary failure', async () => {
  const { provider, calls } = makeProvider([{ status: 500 }])
  await kindOf(provider.history('AAPL'))
  await kindOf(provider.history('AAPL'))
  expect(calls).toHaveLength(2)
})

test('Should fail as not_found on 404', async () => {
  const { provider } = makeProvider([{ status: 404, body: { chart: { result: null, error: { code: 'Not Found' } } } }])
  expect(await kindOf(provider.history('NOEXISTE'))).toBe('not_found')
})

test('Should fail as unavailable on a server error', async () => {
  const { provider } = makeProvider([{ status: 500 }])
  expect(await kindOf(provider.history('AAPL'))).toBe('unavailable')
})

test('Should fail as unavailable on a network error', async () => {
  const { provider } = makeProvider(['network-error'])
  expect(await kindOf(provider.history('AAPL'))).toBe('unavailable')
  expect(await kindOf(provider.quotes(['AAPL']))).toBe('unavailable')
  expect(await kindOf(provider.search('apple'))).toBe('unavailable')
})

test('Should fail as unavailable when the body is not JSON', async () => {
  const fetch: FetchLike = async () => ({
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token')
    },
  })
  const provider = createYahooProvider({ fetch, sleep: async () => {}, now: () => new Date() })
  expect(await kindOf(provider.history('AAPL'))).toBe('unavailable')
})

test('Should batch quotes in groups of 20', async () => {
  const { provider, calls } = makeProvider([{ status: 200, body: { spark: { result: [] } } }])
  const symbols = Array.from({ length: 45 }, (_, i) => `S${i}`)
  await provider.quotes(symbols)
  expect(calls).toHaveLength(3)
  expect(calls[0].url).toBe(
    `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbols.slice(0, 20).join(',')}&range=1d&interval=1d`,
  )
  expect(calls[2].url).toContain(`symbols=${symbols.slice(40).join(',')}&`)
})

test('Should not call Yahoo for an empty list of quotes', async () => {
  const { provider, calls } = makeProvider([{ status: 200, body: {} }])
  expect(await provider.quotes([])).toEqual([])
  expect(calls).toHaveLength(0)
})

test('Should search with an encoded query', async () => {
  const { provider, calls } = makeProvider([{ status: 200, body: searchApple }])
  const out = await provider.search(' coca cola ')
  expect(calls[0].url).toBe('https://query2.finance.yahoo.com/v1/finance/search?q=coca%20cola&quotesCount=10&newsCount=0')
  expect(out[0].symbol).toBe('AAPL')
})

test('Should return no results for a blank search without calling Yahoo', async () => {
  const { provider, calls } = makeProvider([{ status: 200, body: searchApple }])
  expect(await provider.search('   ')).toEqual([])
  expect(calls).toHaveLength(0)
})

const PRE_START = 1_795_510_800
const OPEN = 1_795_530_600
const CLOSE = 1_795_554_000

const sparkOf = (meta: Record<string, unknown>) => ({
  spark: {
    result: [
      {
        symbol: 'AAA',
        response: [
          {
            meta: {
              symbol: 'AAA',
              regularMarketPrice: 200,
              chartPreviousClose: 190,
              hasPrePostMarketData: true,
              fulldayPrice: 203,
              currentTradingPeriod: {
                pre: { start: PRE_START, end: OPEN },
                regular: { start: OPEN, end: CLOSE },
                post: { start: CLOSE, end: CLOSE + 4 * 3600 },
              },
              ...meta,
            },
          },
        ],
      },
    ],
  },
})

const extendedAt = (seconds: number, meta: Record<string, unknown> = {}) =>
  parseQuotes(sparkOf(meta), new Date(seconds * 1000))[0]?.extended

test('Should read the pre-market price and its change from the regular close', () => {
  expect(extendedAt(PRE_START + 600)).toEqual({ session: 'pre', price: 203, changePercent: 1.5 })
})

test('Should read the after-hours price once the regular session has closed', () => {
  expect(extendedAt(CLOSE + 600, { fulldayPrice: 198 })).toEqual({ session: 'post', price: 198, changePercent: -1 })
})

test('Should keep showing the last after-hours price until the next pre-market opens', () => {
  expect(extendedAt(CLOSE + 9 * 3600)?.session).toBe('post')
  expect(extendedAt(PRE_START - 600)?.session).toBe('post')
})

test('Should have no extended price during the regular session', () => {
  expect(extendedAt(OPEN)).toBeNull()
  expect(extendedAt(CLOSE - 1)).toBeNull()
})

test('Should have no extended price for an instrument that does not trade outside regular hours', () => {
  expect(extendedAt(PRE_START + 600, { hasPrePostMarketData: false })).toBeNull()
})

test('Should give the extended price even when it has not moved from the regular close', () => {
  expect(extendedAt(PRE_START + 600, { fulldayPrice: 200 })).toEqual({ session: 'pre', price: 200, changePercent: 0 })
})

test('Should have no extended price when it is missing', () => {
  expect(extendedAt(PRE_START + 600, { fulldayPrice: undefined })).toBeNull()
  expect(extendedAt(PRE_START + 600, { currentTradingPeriod: undefined })).toBeNull()
})

test('Should still give the regular quote when the extended data is unusable', () => {
  const [quote] = parseQuotes(sparkOf({ fulldayPrice: 'caro', currentTradingPeriod: 7 }), new Date(PRE_START * 1000))
  expect(quote).toEqual({ symbol: 'AAA', price: 200, change: 10, changePercent: (10 / 190) * 100, extended: null })
})
