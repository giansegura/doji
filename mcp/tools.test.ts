import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { expect, test } from 'vitest'
import { addWeekdays } from '../shared/dates'
import { type AppState, DEFAULT_STATE, type Drawing, type History, type Quote } from '../shared/types'
import type { DojiApi } from './dojiApi'
import { createDojiServer } from './tools'

const historyOf = (symbol: string, close = 100): History => ({
  info: { symbol, name: `${symbol} Inc.`, exchange: 'NYSE' },
  bars: Array.from({ length: 80 }, (_, index) => ({
    time: addWeekdays('2026-07-01', index),
    open: close,
    high: close + 1,
    low: close - 1,
    close: close + index * 0.1,
    volume: 1000,
  })),
  splits: [{ date: '2024-06-10', numerator: 10, denominator: 1 }],
  fetchedAt: '2026-11-24T10:00:00.000Z',
  stale: false,
})

const trend: Drawing = {
  id: 't',
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2026-09-01', value: 100 },
  p2: { date: '2026-09-15', value: 104 },
  color: '#2962FF',
  width: 2,
  extendRight: true,
  pricedAt: '2024-06-10',
}

const initial: AppState = {
  ...DEFAULT_STATE,
  rev: 5,
  symbol: 'KO',
  timeframe: 'W',
  watchlists: [
    {
      id: 'main',
      name: 'Principal',
      items: [
        { kind: 'section', id: 's1', title: 'En cartera' },
        { symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' },
        { kind: 'section', id: 's2', title: 'Vigilando' },
        { symbol: 'PEP', name: 'PepsiCo', exchange: 'NASDAQ' },
      ],
    },
    { id: 'tech', name: 'Tech', items: [{ symbol: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ' }] },
  ],
  activeWatchlistId: 'main',
  lines: { KO: [trend] },
  notes: { KO: 'Tesis' },
}

const fakeApi = (over: { conflicts?: number; down?: boolean } = {}) => {
  const box = { state: initial, saves: 0, conflicts: over.conflicts ?? 0 }
  const fail = () => {
    if (over.down) throw new Error('doji is not running at http://127.0.0.1:4780. Start it with "npm start" in the doji folder.')
  }
  const api: DojiApi = {
    getState: async () => {
      fail()
      return box.state
    },
    saveState: async (state) => {
      box.saves += 1
      if (box.conflicts > 0) {
        box.conflicts -= 1
        box.state = { ...box.state, rev: box.state.rev + 1, theme: 'light' }
        return 'conflict'
      }
      if (state.rev !== box.state.rev) return 'conflict'
      box.state = { ...state, rev: state.rev + 1 }
      return 'saved'
    },
    getHistory: async (symbol) => {
      fail()
      if (symbol === 'ZZZZ') throw new Error('doji has no data for ZZZZ.')
      return historyOf(symbol)
    },
    getQuotes: async (symbols) =>
      symbols.map((symbol): Quote => ({ symbol, price: 100, change: 1, changePercent: 1, extended: null })),
  }
  return { api, box }
}

const connect = async (api: DojiApi) => {
  let counter = 0
  const server = createDojiServer({
    api,
    newId: () => {
      counter += 1
      return `ai-${counter}`
    },
    version: 'test',
  })
  const client = new Client({ name: 'test', version: 'test' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args })
    const [first] = result.content as { type: string; text: string }[]
    return { failed: result.isError === true, text: first.text, data: result.isError ? null : JSON.parse(first.text) }
  }
  return { client, call }
}

test('Should offer six tools and tell the reading ones from the writing ones', async () => {
  const { client } = await connect(fakeApi().api)
  const { tools } = await client.listTools()
  expect(tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint ?? false])).toEqual([
    ['get_watchlists', true],
    ['scan_watchlist', true],
    ['get_chart', true],
    ['add_horizontal_line', false],
    ['set_alert', false],
    ['write_note', false],
  ])
  expect(tools.every((tool) => (tool.description ?? '').length > 40)).toBe(true)
})

test('Should explain to the model what doji is and how to use it', async () => {
  const { client } = await connect(fakeApi().api)
  expect(client.getInstructions()).toContain("user's own stock charting app")
})

test('Should list the watchlists with their sections, the active one and what is on screen', async () => {
  const { call } = await connect(fakeApi().api)
  expect((await call('get_watchlists')).data).toEqual({
    onScreen: { symbol: 'KO', timeframe: 'W' },
    watchlists: [
      {
        id: 'main',
        name: 'Principal',
        active: true,
        items: [
          { section: 'En cartera' },
          { symbol: 'KO', name: 'Coca-Cola' },
          { section: 'Vigilando' },
          { symbol: 'PEP', name: 'PepsiCo' },
        ],
      },
      { id: 'tech', name: 'Tech', active: false, items: [{ symbol: 'NVDA', name: 'NVIDIA' }] },
    ],
  })
})

test('Should summarize a chart with the drawings and the note of the symbol', async () => {
  const { call } = await connect(fakeApi().api)
  const { data } = await call('get_chart', { symbol: 'ko' })
  expect(data).toMatchObject({ symbol: 'KO', timeframe: 'D', note: 'Tesis', drawings: [{ id: 't', kind: 'trend', alert: false }] })
  expect(data.recentBars.rows).toHaveLength(60)
  expect(data.price.extended).toBeNull()
})

test('Should summarize a chart on the asked timeframe with the asked number of bars', async () => {
  const { call } = await connect(fakeApi().api)
  const { data } = await call('get_chart', { symbol: 'PEP', timeframe: 'W', bars: 3 })
  expect(data).toMatchObject({ symbol: 'PEP', timeframe: 'W', note: null, drawings: [] })
  expect(data.recentBars.rows).toHaveLength(3)
})

test('Should report a symbol doji does not know as a failed call', async () => {
  const { call } = await connect(fakeApi().api)
  expect(await call('get_chart', { symbol: 'ZZZZ' })).toEqual({ failed: true, text: 'doji has no data for ZZZZ.', data: null })
})

test('Should scan the active watchlist row by row, keeping its sections', async () => {
  const { call } = await connect(fakeApi().api)
  const { data } = await call('scan_watchlist')
  expect(data.watchlist).toBe('Principal')
  expect(data.timeframe).toBe('D')
  expect(data.rows.map((row: { section?: string; symbol?: string }) => row.section ?? row.symbol)).toEqual([
    'En cartera',
    'KO',
    'Vigilando',
    'PEP',
  ])
  expect(data.rows[1]).toMatchObject({ symbol: 'KO', alerts: 0, hasNote: true })
})

test('Should scan another watchlist named by its name in any case', async () => {
  const { call } = await connect(fakeApi().api)
  expect((await call('scan_watchlist', { watchlist: 'tech' })).data.rows.map((row: { symbol: string }) => row.symbol)).toEqual([
    'NVDA',
  ])
  expect(await call('scan_watchlist', { watchlist: 'Nada' })).toEqual({
    failed: true,
    text: 'There is no watchlist called "Nada". The watchlists are: Principal, Tech.',
    data: null,
  })
})

test('Should add a horizontal line priced after the latest split and say where it went', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  const { data } = await call('add_horizontal_line', { symbol: 'pep', price: 98.5, alert: true })
  expect(data).toEqual({ id: 'ai-1', symbol: 'PEP', price: 98.5, alert: true, message: 'Added. It shows in doji within a few seconds.' })
  expect(box.state.lines.PEP).toEqual([
    {
      kind: 'hline',
      id: 'ai-1',
      pane: 'price',
      timeframe: 'D',
      value: 98.5,
      color: '#2962FF',
      width: 2,
      pricedAt: '2024-06-10',
      alert: true,
    },
  ])
  expect(box.state.rev).toBe(6)
})

test('Should try again on top of a change that was saved meanwhile and keep it', async () => {
  const { api, box } = fakeApi({ conflicts: 1 })
  const { call } = await connect(api)
  await call('add_horizontal_line', { symbol: 'KO', price: 99 })
  expect(box.saves).toBe(2)
  expect(box.state.theme).toBe('light')
  expect(box.state.lines.KO.map((drawing) => drawing.id)).toEqual(['t', 'ai-1'])
})

test('Should give up after three changes saved meanwhile', async () => {
  const { call } = await connect(fakeApi({ conflicts: 3 }).api)
  expect(await call('add_horizontal_line', { symbol: 'KO', price: 99 })).toMatchObject({
    failed: true,
    text: 'doji kept changing while saving. Try again.',
  })
})

test('Should refuse a horizontal line with a price that is not positive', async () => {
  const { call } = await connect(fakeApi().api)
  const result = await call('add_horizontal_line', { symbol: 'KO', price: -3 })
  expect(result.failed).toBe(true)
})

test('Should arm the alert of an existing line and refuse one that does not exist', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('set_alert', { symbol: 'KO', drawing_id: 't' })).data).toMatchObject({ id: 't', alert: true })
  expect(box.state.lines.KO[0]).toMatchObject({ id: 't', alert: true })
  expect(await call('set_alert', { symbol: 'KO', drawing_id: 'zz', on: false })).toEqual({
    failed: true,
    text: 'KO has no drawing with id "zz".',
    data: null,
  })
})

test('Should add to the note of a symbol and say how long it is', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('write_note', { symbol: 'KO', text: 'Stop en 52' })).data).toEqual({ symbol: 'KO', length: 17, truncated: false })
  expect(box.state.notes.KO).toBe('Tesis\n\nStop en 52')
})

test('Should say how to start doji when it is not running', async () => {
  const { call } = await connect(fakeApi({ down: true }).api)
  expect(await call('get_watchlists')).toEqual({
    failed: true,
    text: 'doji is not running at http://127.0.0.1:4780. Start it with "npm start" in the doji folder.',
    data: null,
  })
})
