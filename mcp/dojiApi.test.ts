import { expect, test, vi } from 'vitest'
import { DEFAULT_STATE } from '../shared/types'
import { createDojiApi, isMissingSymbol } from './dojiApi'

const BASE = 'http://127.0.0.1:4780'

const reply = (status: number, body: unknown) =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))

const callsOf = (fetch: ReturnType<typeof reply>) => fetch.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET'])

test('Should read the state of doji', async () => {
  const fetch = reply(200, DEFAULT_STATE)
  expect(await createDojiApi({ baseUrl: BASE, fetch }).getState()).toEqual(DEFAULT_STATE)
  expect(callsOf(fetch)).toEqual([[`${BASE}/api/state`, 'GET']])
})

test('Should save a state on top of the revision it carries', async () => {
  const fetch = reply(200, { ok: true, rev: 8 })
  expect(await createDojiApi({ baseUrl: BASE, fetch }).saveState({ ...DEFAULT_STATE, rev: 7 })).toBe('saved')
  const [url, init] = fetch.mock.calls[0]
  expect([url, init?.method]).toEqual([`${BASE}/api/state`, 'PUT'])
  expect(JSON.parse(init?.body as string).rev).toBe(7)
})

test('Should report that another change was saved first', async () => {
  expect(await createDojiApi({ baseUrl: BASE, fetch: reply(409, { error: 'conflict' }) }).saveState(DEFAULT_STATE)).toBe('conflict')
})

test('Should ask for the history and the quotes of symbols, escaping them', async () => {
  const fetch = reply(200, [])
  const api = createDojiApi({ baseUrl: BASE, fetch })
  await api.getHistory('BRK-B')
  await api.getQuotes(['^GSPC', 'KO'])
  expect(callsOf(fetch)).toEqual([
    [`${BASE}/api/history?symbol=BRK-B`, 'GET'],
    [`${BASE}/api/quotes?symbols=%5EGSPC,KO`, 'GET'],
  ])
})

test('Should say that a symbol is unknown', async () => {
  const api = createDojiApi({ baseUrl: BASE, fetch: reply(404, { error: 'not_found' }) })
  const error = await api.getHistory('ZZZZ').catch((failure: unknown) => failure)
  expect((error as Error).message).toBe('doji has no data for ZZZZ.')
  expect(isMissingSymbol(error)).toBe(true)
  expect(isMissingSymbol(new Error('doji is not running'))).toBe(false)
})

test('Should say how to start doji when it does not answer', async () => {
  const fetch = vi.fn(async () => {
    throw new TypeError('fetch failed')
  })
  await expect(createDojiApi({ baseUrl: BASE, fetch }).getState()).rejects.toThrow(
    `doji is not running at ${BASE}. Start it with "npm start" in the doji folder.`,
  )
})

test('Should pass on any other failure with its status', async () => {
  await expect(createDojiApi({ baseUrl: BASE, fetch: reply(502, { error: 'unavailable' }) }).getState()).rejects.toThrow(
    'doji answered 502 (unavailable).',
  )
})
