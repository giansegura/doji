import { afterEach, expect, test, vi } from 'vitest'
import { type AppState, DEFAULT_STATE, type TrendLine } from '../../shared/types'
import { getHistory, getKeptHistory, getWatchMetrics, putState } from './client'

const reply = (status: number, body: unknown) =>
  vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }))

afterEach(() => {
  vi.unstubAllGlobals()
})

test('Should report the new revision when the state is saved', async () => {
  const fetchMock = reply(200, { ok: true, rev: 8 })
  vi.stubGlobal('fetch', fetchMock)
  expect(await putState({ ...DEFAULT_STATE, rev: 7 })).toEqual({ kind: 'saved', rev: 8 })
  const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(path).toBe('/api/state')
  expect(init.method).toBe('PUT')
  expect(JSON.parse(init.body as string).rev).toBe(7)
  expect(init.keepalive).toBe(false)
})

test('Should report a conflict when the server has a newer state', async () => {
  vi.stubGlobal('fetch', reply(409, { error: 'conflict' }))
  expect(await putState(DEFAULT_STATE)).toEqual({ kind: 'conflict' })
})

test('Should report a failure for any other answer', async () => {
  vi.stubGlobal('fetch', reply(400, { error: 'invalid_state' }))
  expect(await putState(DEFAULT_STATE)).toEqual({ kind: 'failed' })
  vi.stubGlobal('fetch', reply(500, null))
  expect(await putState(DEFAULT_STATE)).toEqual({ kind: 'failed' })
  vi.stubGlobal('fetch', reply(200, { ok: true }))
  expect(await putState(DEFAULT_STATE)).toEqual({ kind: 'failed' })
})

test('Should report a failure when the server cannot be reached', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }),
  )
  expect(await putState(DEFAULT_STATE, true)).toEqual({ kind: 'failed' })
})

const line = (id: string): TrendLine => ({
  id,
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2026-11-18', value: 10 },
  p2: { date: '2026-11-23', value: 12 },
  color: '#2962FF',
  width: 2,
  extendRight: false,
  pricedAt: '2020-08-31',
})

const heavy: AppState = {
  ...DEFAULT_STATE,
  rev: 7,
  lines: { AAPL: Array.from({ length: 400 }, (_, index) => line(`linea-${index}`)) },
}

const sentBy = async (state: AppState, keepalive: boolean, saved: AppState | null) => {
  const fetchMock = reply(200, { ok: true, rev: 8 })
  vi.stubGlobal('fetch', fetchMock)
  const result = await putState(state, keepalive, saved)
  const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  return { result, path, method: init.method, body: JSON.parse(init.body as string) as Record<string, unknown>, init }
}

test('Should send only the changes when the whole state is too big to outlive the page', async () => {
  const sent = await sentBy({ ...heavy, theme: 'light' }, true, heavy)
  expect(sent.path).toBe('/api/state')
  expect(sent.method).toBe('PATCH')
  expect(sent.body).toEqual({ rev: 7, changes: { theme: 'light' } })
  expect(sent.init.keepalive).toBe(true)
  expect(sent.result).toEqual({ kind: 'saved', rev: 8 })
})

test('Should send the whole state when it is small enough to outlive the page', async () => {
  const light: AppState = { ...DEFAULT_STATE, rev: 7 }
  const sent = await sentBy({ ...light, theme: 'light' }, true, light)
  expect(sent.method).toBe('PUT')
  expect(sent.body.theme).toBe('light')
  expect(sent.body.watchlists).toEqual(DEFAULT_STATE.watchlists)
})

test('Should send the whole state while the page stays open, whatever its size', async () => {
  const sent = await sentBy({ ...heavy, theme: 'light' }, false, heavy)
  expect(sent.method).toBe('PUT')
  expect(sent.body.lines).toEqual(heavy.lines)
})

test('Should send the whole state when it does not know what the server has', async () => {
  const sent = await sentBy({ ...heavy, theme: 'light' }, true, null)
  expect(sent.method).toBe('PUT')
})

test('Should ask for the kept copy of a history without waiting for the source', async () => {
  const fetchMock = reply(200, { info: { symbol: 'BRK-B' } })
  vi.stubGlobal('fetch', fetchMock)
  await getKeptHistory('BRK-B')
  await getHistory('BRK-B')
  expect(fetchMock.mock.calls.map((call) => (call as unknown as [string])[0])).toEqual([
    '/api/history?symbol=BRK-B&cached=1',
    '/api/history?symbol=BRK-B',
  ])
})

test('Should ask for the columns of a long list in batches the server takes and join the answers', async () => {
  const symbols = Array.from({ length: 250 }, (_, index) => `S${index}`)
  const fetchMock = vi.fn(async (url: string) => {
    const asked = (new URL(url, 'http://doji').searchParams.get('symbols') ?? '').split(',')
    const metrics = Object.fromEntries(asked.slice(0, 1).map((symbol) => [symbol, { rsi: 50 }]))
    return { ok: true, status: 200, json: async () => ({ metrics, pending: asked.length }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  const answer = await getWatchMetrics(symbols, true, true)
  const urls = fetchMock.mock.calls.map((call) => new URL((call as unknown as [string])[0], 'http://doji'))
  expect(urls.map((url) => (url.searchParams.get('symbols') ?? '').split(',').length)).toEqual([200, 50])
  expect(urls.every((url) => url.searchParams.get('level') === '1' && url.searchParams.get('all') === '1')).toBe(true)
  expect(Object.keys(answer.metrics)).toEqual(['S0', 'S200'])
  expect(answer.pending).toBe(250)
})
