import { expect, test } from 'vitest'
import { type AppState, DEFAULT_STATE, type History } from '../shared/types'
import { type DataProvider, providerError } from './provider/yahoo'
import { type ApiResult, createApi, expectsBody, isLocalHost, isOwnRequest, parseRequestUrl } from './routes'

const historyOf = (symbol: string): History => ({
  info: { symbol, name: `${symbol} Inc.`, exchange: 'NASDAQ' },
  bars: [{ time: '2026-11-23', open: 1, high: 2, low: 1, close: 2, volume: 3 }],
  splits: [],
  fetchedAt: '2026-11-23T20:00:00.000Z',
  stale: false,
})

type Overrides = {
  getHistory?: (symbol: string) => Promise<History>
  search?: DataProvider['search']
  quotes?: DataProvider['quotes']
}

const makeApi = (over: Overrides = {}) => {
  const saved: AppState[] = []
  const requested: { history: string[]; search: string[]; quotes: string[][]; logos: string[] } = {
    history: [],
    search: [],
    quotes: [],
    logos: [],
  }
  const api = createApi({
    history: {
      get: async (symbol) => {
        requested.history.push(symbol)
        return (over.getHistory ?? (async (s: string) => historyOf(s)))(symbol)
      },
    },
    provider: {
      history: async (symbol) => historyOf(symbol),
      logoUrl: async () => null,
      search: async (query) => {
        requested.search.push(query)
        return (over.search ?? (async () => [{ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }]))(query)
      },
      quotes: async (symbols) => {
        requested.quotes.push(symbols)
        const fallback = async (list: string[]) => list.map((symbol) => ({ symbol, price: 10, change: 1, changePercent: 10 }))
        return (over.quotes ?? fallback)(symbols)
      },
    },
    logos: {
      get: async (symbol) => {
        requested.logos.push(symbol)
        return symbol === 'SINLOGO' ? null : { bytes: Buffer.from('PNG'), contentType: 'image/png' }
      },
    },
    state: {
      read: async () => ({ ...DEFAULT_STATE, symbol: 'KO' }),
      save: async (state, baseRev) => {
        if (baseRev !== 1) return { ok: false, reason: 'conflict' }
        saved.push(state)
        return { ok: true, rev: 2 }
      },
    },
  })
  const call = (method: string, target: string, body?: unknown) => {
    const url = new URL(target, 'http://127.0.0.1')
    return api({ method, path: url.pathname, query: url.searchParams, body })
  }
  return { call, saved, requested }
}

const bodyOf = (result: ApiResult): unknown => ('body' in result ? result.body : undefined)

const failing = (kind: 'not_found' | 'rate_limited' | 'unavailable') => async () => {
  throw providerError(kind, kind)
}

test('Should return the history of a symbol', async () => {
  const { call, requested } = makeApi()
  const result = await call('GET', '/api/history?symbol=AAPL')
  expect(result.status).toBe(200)
  expect(bodyOf(result)).toEqual(historyOf('AAPL'))
  expect(requested.history).toEqual(['AAPL'])
})

test('Should accept symbols with dashes, dots and carets', async () => {
  const { call, requested } = makeApi()
  const statuses = await Promise.all(
    ['BRK-B', 'BF.B', '%5EGSPC'].map(async (symbol) => (await call('GET', `/api/history?symbol=${symbol}`)).status),
  )
  expect(statuses).toEqual([200, 200, 200])
  expect(requested.history).toEqual(['BRK-B', 'BF.B', '^GSPC'])
})

test('Should reject a missing or malformed symbol without asking for data', async () => {
  const { call, requested } = makeApi()
  const targets = [
    '/api/history',
    '/api/history?symbol=',
    '/api/history?symbol=../x',
    '/api/history?symbol=A%20B',
    '/api/history?symbol=ABCDEFGHIJKLMNOPQ',
    '/api/history?symbol=..',
    '/api/history?symbol=.AAPL',
  ]
  const results = await Promise.all(targets.map((target) => call('GET', target)))
  expect(results.map((result) => result.status)).toEqual([400, 400, 400, 400, 400, 400, 400])
  expect(bodyOf(results[0])).toEqual({ error: 'invalid_symbol' })
  expect(requested.history).toEqual([])
})

test('Should answer 404 for an unknown symbol', async () => {
  const { call } = makeApi({ getHistory: failing('not_found') })
  expect(await call('GET', '/api/history?symbol=NOEXISTE')).toEqual({ status: 404, body: { error: 'not_found' } })
})

test('Should answer 502 when the source is unavailable or rate limited', async () => {
  const unavailable = await makeApi({ getHistory: failing('unavailable') }).call('GET', '/api/history?symbol=AAPL')
  const limited = await makeApi({ getHistory: failing('rate_limited') }).call('GET', '/api/history?symbol=AAPL')
  expect(unavailable).toEqual({ status: 502, body: { error: 'unavailable' } })
  expect(limited).toEqual({ status: 502, body: { error: 'unavailable' } })
})

test('Should answer 500 for an unexpected failure', async () => {
  const { call } = makeApi({
    getHistory: async () => {
      throw new Error('disco lleno')
    },
  })
  expect(await call('GET', '/api/history?symbol=AAPL')).toEqual({ status: 500, body: { error: 'internal' } })
})

test('Should search symbols', async () => {
  const { call, requested } = makeApi()
  const result = await call('GET', '/api/search?q=apple%20inc')
  expect(result).toEqual({ status: 200, body: [{ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }] })
  expect(requested.search).toEqual(['apple inc'])
})

test('Should answer an empty list for a search without text', async () => {
  const { call, requested } = makeApi()
  expect(await call('GET', '/api/search')).toEqual({ status: 200, body: [] })
  expect(requested.search).toEqual([])
})

test('Should answer 502 when the search fails', async () => {
  const { call } = makeApi({ search: failing('unavailable') })
  expect(await call('GET', '/api/search?q=apple')).toEqual({ status: 502, body: { error: 'unavailable' } })
})

test('Should quote only well-formed symbols, in upper case', async () => {
  const { call, requested } = makeApi()
  const result = await call('GET', '/api/quotes?symbols=aapl,../x,BRK-B,,MSFT')
  expect(result.status).toBe(200)
  expect(requested.quotes).toEqual([['AAPL', 'BRK-B', 'MSFT']])
  expect(bodyOf(result)).toHaveLength(3)
})

test('Should answer an empty list without asking when no symbol is valid', async () => {
  const { call, requested } = makeApi()
  expect(await call('GET', '/api/quotes')).toEqual({ status: 200, body: [] })
  expect(await call('GET', '/api/quotes?symbols=../x')).toEqual({ status: 200, body: [] })
  expect(requested.quotes).toEqual([])
})

test('Should answer 502 when quotes fail', async () => {
  const { call } = makeApi({ quotes: failing('rate_limited') })
  expect(await call('GET', '/api/quotes?symbols=AAPL')).toEqual({ status: 502, body: { error: 'unavailable' } })
})

test('Should return the logo of a symbol as an image', async () => {
  const { call, requested } = makeApi()
  const result = await call('GET', '/api/logo?symbol=BRK-B')
  expect(result).toEqual({ status: 200, image: { bytes: Buffer.from('PNG'), contentType: 'image/png' } })
  expect(requested.logos).toEqual(['BRK-B'])
})

test('Should answer 404 when a symbol has no logo', async () => {
  const { call } = makeApi()
  expect(await call('GET', '/api/logo?symbol=SINLOGO')).toEqual({ status: 404, body: { error: 'not_found' } })
})

test('Should reject a malformed symbol when asking for a logo', async () => {
  const { call, requested } = makeApi()
  expect(await call('GET', '/api/logo?symbol=../x')).toEqual({ status: 400, body: { error: 'invalid_symbol' } })
  expect(requested.logos).toEqual([])
})

test('Should return the saved state', async () => {
  const { call } = makeApi()
  expect(await call('GET', '/api/state')).toEqual({ status: 200, body: { ...DEFAULT_STATE, symbol: 'KO' } })
})

test('Should save a state', async () => {
  const { call, saved } = makeApi()
  const state: AppState = { ...DEFAULT_STATE, theme: 'light', symbol: 'MSFT' }
  expect(await call('PUT', '/api/state', state)).toEqual({ status: 200, body: { ok: true, rev: 2 } })
  expect(saved).toEqual([state])
})

test('Should answer 409 when the state changed since it was loaded', async () => {
  const { call, saved } = makeApi()
  const stale: AppState = { ...DEFAULT_STATE, rev: 5 }
  expect(await call('PUT', '/api/state', stale)).toEqual({ status: 409, body: { error: 'conflict' } })
  expect(saved).toEqual([])
})

test('Should refuse to save a body that is not a whole state', async () => {
  const { call, saved } = makeApi()
  const { rev: _rev, ...withoutRev } = DEFAULT_STATE
  const { lines: _lines, ...withoutLines } = DEFAULT_STATE
  const bodies = ['basura', {}, { theme: 'light', watchlist: [] }, withoutRev, withoutLines, { ...DEFAULT_STATE, watchlists: 'x' }]
  const results = await Promise.all(bodies.map((body) => call('PUT', '/api/state', body)))
  expect(results.map((result) => result.status)).toEqual([400, 400, 400, 400, 400, 400])
  expect(bodyOf(results[0])).toEqual({ error: 'invalid_state' })
  expect(saved).toEqual([])
})

test('Should answer 404 for an unknown route or method', async () => {
  const { call, saved } = makeApi()
  expect(await call('GET', '/api/nada')).toEqual({ status: 404, body: { error: 'not_found' } })
  expect(await call('POST', '/api/history?symbol=AAPL')).toEqual({ status: 404, body: { error: 'not_found' } })
  expect(await call('DELETE', '/api/state')).toEqual({ status: 404, body: { error: 'not_found' } })
  expect(saved).toEqual([])
})

test('Should read the path and query of a request', () => {
  const url = parseRequestUrl('/api/history?symbol=BRK-B')
  expect(url?.pathname).toBe('/api/history')
  expect(url?.searchParams.get('symbol')).toBe('BRK-B')
  expect(parseRequestUrl(undefined)?.pathname).toBe('/')
})

test('Should refuse a request target that is not a path instead of failing', () => {
  expect(parseRequestUrl('//')).toBe(null)
  expect(parseRequestUrl('//[')).toBe(null)
  expect(parseRequestUrl('http://[')).toBe(null)
})

test('Should only accept requests addressed to this machine', () => {
  expect(isLocalHost('127.0.0.1:4780')).toBe(true)
  expect(isLocalHost('localhost:5173')).toBe(true)
  expect(isLocalHost('localhost')).toBe(true)
  expect(isLocalHost('[::1]:4780')).toBe(true)
  expect(isLocalHost('evil.example.com:4780')).toBe(false)
  expect(isLocalHost('127.0.0.1.evil.example.com')).toBe(false)
  expect(isLocalHost(undefined)).toBe(false)
})

test('Should accept requests from the app itself, from the address bar and from tools', () => {
  expect(isOwnRequest('same-origin')).toBe(true)
  expect(isOwnRequest('none')).toBe(true)
  expect(isOwnRequest(undefined)).toBe(true)
})

test('Should refuse requests that other sites make', () => {
  expect(isOwnRequest('cross-site')).toBe(false)
  expect(isOwnRequest('same-site')).toBe(false)
  expect(isOwnRequest('')).toBe(false)
  expect(isOwnRequest(['same-origin', 'cross-site'])).toBe(false)
})

const drawn = {
  id: 'a',
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2026-11-18', value: 10 },
  p2: { date: '2026-11-23', value: 12 },
  color: '#2962FF',
  width: 2,
  extendRight: false,
  pricedAt: '2020-08-31',
}

test('Should apply the changes it receives over the saved state', async () => {
  const { call, saved } = makeApi()
  const result = await call('PATCH', '/api/state', { rev: 1, changes: { theme: 'light', lines: { AAPL: [drawn] } } })
  expect(result).toEqual({ status: 200, body: { ok: true, rev: 2 } })
  expect(saved).toHaveLength(1)
  expect(saved[0].theme).toBe('light')
  expect(saved[0].symbol).toBe('KO')
  expect(saved[0].watchlists).toEqual(DEFAULT_STATE.watchlists)
  expect(saved[0].lines).toEqual({ AAPL: [drawn] })
})

test('Should refuse changes based on another revision', async () => {
  const { call, saved } = makeApi()
  const result = await call('PATCH', '/api/state', { rev: 5, changes: { theme: 'light' } })
  expect(result).toEqual({ status: 409, body: { error: 'conflict' } })
  expect(saved).toEqual([])
})

test('Should refuse changes that are not well formed', async () => {
  const { call, saved } = makeApi()
  const bodies = [
    null,
    'x',
    { changes: {} },
    { rev: 1 },
    { rev: 1.5, changes: {} },
    { rev: 1, changes: [] },
    { rev: 1, changes: { lines: [] } },
    { rev: 1, changes: { lines: { AAPL: 'x' } } },
  ]
  const results = await Promise.all(bodies.map((body) => call('PATCH', '/api/state', body)))
  expect(results.map((result) => result.status)).toEqual(bodies.map(() => 400))
  expect(saved).toEqual([])
})

test('Should clean the changes like any other state', async () => {
  const { call, saved } = makeApi()
  await call('PATCH', '/api/state', { rev: 1, changes: { theme: 'neon', intruso: true, lines: { AAPL: [{ id: 'roto' }] } } })
  expect(saved[0].theme).toBe(DEFAULT_STATE.theme)
  expect(saved[0].lines).toEqual({})
  expect('intruso' in saved[0]).toBe(false)
})

test('Should read a body only for the requests that write', () => {
  expect(expectsBody('PUT')).toBe(true)
  expect(expectsBody('PATCH')).toBe(true)
  expect(expectsBody('GET')).toBe(false)
})
