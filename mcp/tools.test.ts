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
  flags: { PEP: 'green' },
}

const fakeApi = (
  over: { conflicts?: number; down?: boolean; state?: AppState; meanwhile?: (state: AppState) => AppState; pendingEarnings?: number } = {},
) => {
  const box = { state: over.state ?? initial, saves: 0, conflicts: over.conflicts ?? 0, calendarAsked: [] as string[][] }
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
        box.state = { ...(over.meanwhile ?? ((state: AppState) => ({ ...state, theme: 'light' })))(box.state), rev: box.state.rev + 1 }
        return 'conflict'
      }
      if (state.rev !== box.state.rev) return 'conflict'
      box.state = { ...state, rev: state.rev + 1 }
      return 'saved'
    },
    getHistory: async (symbol) => {
      fail()
      if (symbol === 'ZZZZ') throw Object.assign(new Error('doji has no data for ZZZZ.'), { missing: true })
      return historyOf(symbol)
    },
    getQuotes: async (symbols) =>
      symbols.map((symbol): Quote => ({ symbol, price: 100, change: 1, changePercent: 1, extended: null })),
    getEarningsCalendar: async (symbols) => {
      box.calendarAsked.push(symbols)
      return {
        earnings: {
          KO: { past: ['2026-10-21'], next: '2026-11-26', nextIsEstimate: false, timing: { '2026-11-26': 'post' } },
          PEP: { past: ['2026-11-20'], next: null, nextIsEstimate: false },
          NVDA: { past: [], next: '2026-12-20', nextIsEstimate: true },
        },
        pending: over.pendingEarnings ?? 0,
      }
    },
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
    today: () => '2026-11-24',
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

test('Should offer its tools and tell the reading ones from the writing ones and the ones that remove', async () => {
  const { client } = await connect(fakeApi().api)
  const { tools } = await client.listTools()
  expect(tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint ?? false, tool.annotations?.destructiveHint ?? false])).toEqual([
    ['get_watchlists', true, false],
    ['scan_watchlist', true, false],
    ['get_chart', true, false],
    ['get_earnings_calendar', true, false],
    ['add_horizontal_line', false, false],
    ['set_alert', false, false],
    ['write_note', false, true],
    ['create_watchlist', false, false],
    ['add_to_watchlist', false, false],
    ['add_section', false, false],
    ['remove_from_watchlist', false, true],
    ['rename_watchlist', false, false],
    ['set_watchlist_icon', false, false],
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
        icon: null,
        active: true,
        items: [
          { section: 'En cartera' },
          { symbol: 'KO', name: 'Coca-Cola' },
          { section: 'Vigilando' },
          { symbol: 'PEP', name: 'PepsiCo', flag: 'green' },
        ],
      },
      { id: 'tech', name: 'Tech', icon: null, active: false, items: [{ symbol: 'NVDA', name: 'NVIDIA' }] },
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
  expect(data.rows[1].flag).toBeUndefined()
  expect(data.rows[3]).toMatchObject({ symbol: 'PEP', flag: 'green' })
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

test('Should scan every symbol of a long watchlist', async () => {
  const symbols = Array.from({ length: 45 }, (_, index) => `S${index}`)
  const long: AppState = {
    ...initial,
    watchlists: [
      {
        id: 'main',
        name: 'Principal',
        items: [{ kind: 'section', id: 's', title: 'Todo' }, ...symbols.map((symbol) => ({ symbol, name: symbol, exchange: 'NYSE' }))],
      },
    ],
  }
  const { call } = await connect(fakeApi({ state: long }).api)
  const { data } = await call('scan_watchlist')
  expect(data.rows).toHaveLength(46)
  expect(data.rows.at(-1)).toMatchObject({ symbol: 'S44' })
})

const itemsIn = (state: AppState, name: string) =>
  state.watchlists.find((list) => list.name === name)?.items.map((item) => ('kind' in item ? `[${item.title}]` : item.symbol))

test('Should create a watchlist with the symbols doji knows and say which ones it does not', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  const { data } = await call('create_watchlist', { name: 'Dividendos', symbols: ['ko', 'PG', 'ZZZZ'] })
  expect(data).toEqual({ id: 'ai-1', name: 'Dividendos', added: ['KO', 'PG'], icon: null, notFound: ['ZZZZ'] })
  expect(itemsIn(box.state, 'Dividendos')).toEqual(['KO', 'PG'])
  expect(box.state.watchlists.find((list) => list.name === 'Dividendos')?.items[1]).toEqual({ symbol: 'PG', name: 'PG Inc.', exchange: 'NYSE' })
  expect(box.state.activeWatchlistId).toBe('main')
})

test('Should create an empty watchlist and refuse a name already taken', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('create_watchlist', { name: 'Vacía' })).data).toEqual({ id: 'ai-1', name: 'Vacía', added: [], icon: null, notFound: [] })
  expect(itemsIn(box.state, 'Vacía')).toEqual([])
  expect(await call('create_watchlist', { name: 'tech' })).toMatchObject({ failed: true, text: 'There is already a watchlist called "Tech".' })
})

test('Should add symbols to the active watchlist or to the one named, inside a section if asked', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('add_to_watchlist', { symbols: ['MSFT', 'KO'] })).data).toEqual({
    watchlist: 'Principal',
    added: ['MSFT'],
    already: ['KO'],
    notFound: [],
  })
  expect(itemsIn(box.state, 'Principal')).toEqual(['[En cartera]', 'KO', '[Vigilando]', 'PEP', 'MSFT'])
  await call('add_to_watchlist', { watchlist: 'Principal', symbols: ['V'], section: 'en cartera' })
  expect(itemsIn(box.state, 'Principal')).toEqual(['[En cartera]', 'KO', 'V', '[Vigilando]', 'PEP', 'MSFT'])
  await call('add_to_watchlist', { watchlist: 'tech', symbols: ['AMD', 'ZZZZ'] })
  expect(itemsIn(box.state, 'Tech')).toEqual(['NVDA', 'AMD'])
})

test('Should refuse a watchlist or a section that does not exist', async () => {
  const { call } = await connect(fakeApi().api)
  expect(await call('add_to_watchlist', { watchlist: 'Nada', symbols: ['MSFT'] })).toMatchObject({
    failed: true,
    text: 'There is no watchlist called "Nada". The watchlists are: Principal, Tech.',
  })
  expect(await call('add_to_watchlist', { symbols: ['MSFT'], section: 'Bancos' })).toMatchObject({
    failed: true,
    text: 'Principal has no section called "Bancos". Its sections are: En cartera, Vigilando.',
  })
})

test('Should add a section to a watchlist', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('add_section', { watchlist: 'Tech', title: 'Semis' })).data).toEqual({ watchlist: 'Tech', id: 'ai-1', title: 'Semis' })
  expect(itemsIn(box.state, 'Tech')).toEqual(['NVDA', '[Semis]'])
})

test('Should remove symbols from a watchlist and say which ones were not in it', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('remove_from_watchlist', { symbols: ['pep', 'AAPL'] })).data).toEqual({
    watchlist: 'Principal',
    removed: ['PEP'],
    missing: ['AAPL'],
  })
  expect(itemsIn(box.state, 'Principal')).toEqual(['[En cartera]', 'KO', '[Vigilando]'])
})

test('Should rename a watchlist', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('rename_watchlist', { watchlist: 'Tech', name: 'Semis' })).data).toEqual({ id: 'tech', name: 'Semis' })
  expect(box.state.watchlists.map((list) => list.name)).toEqual(['Principal', 'Semis'])
})

test('Should say how to start doji instead of calling every symbol unknown when doji is not running', async () => {
  const { call } = await connect(fakeApi({ down: true }).api)
  expect(await call('create_watchlist', { name: 'Dividendos', symbols: ['KO'] })).toMatchObject({
    failed: true,
    text: 'doji is not running at http://127.0.0.1:4780. Start it with "npm start" in the doji folder.',
  })
})

test('Should create a watchlist with an icon and show the icons in the list of watchlists', async () => {
  const { api } = fakeApi()
  const { call } = await connect(api)
  expect((await call('create_watchlist', { name: 'Bancos', icon: '🏦' })).data).toMatchObject({ name: 'Bancos', icon: '🏦' })
  const { data } = await call('get_watchlists')
  expect(data.watchlists.map((list: { name: string; icon: string | null }) => [list.name, list.icon])).toEqual([
    ['Principal', null],
    ['Tech', null],
    ['Bancos', '🏦'],
  ])
})

test('Should put an icon on a watchlist and take it away', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('set_watchlist_icon', { watchlist: 'Tech', icon: '💻' })).data).toEqual({ id: 'tech', icon: '💻' })
  expect(box.state.watchlists[1].icon).toBe('💻')
  expect((await call('set_watchlist_icon', { watchlist: 'Tech', icon: '' })).data).toEqual({ id: 'tech', icon: null })
  expect(box.state.watchlists[1].icon).toBeUndefined()
})

test('Should keep working on the watchlist that was active when asked, even if the user switches lists meanwhile', async () => {
  const { api, box } = fakeApi({ conflicts: 1, meanwhile: (state) => ({ ...state, activeWatchlistId: 'tech' }) })
  const { call } = await connect(api)
  expect((await call('remove_from_watchlist', { symbols: ['PEP', 'NVDA'] })).data).toEqual({
    watchlist: 'Principal',
    removed: ['PEP'],
    missing: ['NVDA'],
  })
  expect(itemsIn(box.state, 'Tech')).toEqual(['NVDA'])
})

test('Should add to the watchlist that was active when asked, even if the user switches lists meanwhile', async () => {
  const { api, box } = fakeApi({ conflicts: 1, meanwhile: (state) => ({ ...state, activeWatchlistId: 'tech' }) })
  const { call } = await connect(api)
  expect((await call('add_to_watchlist', { symbols: ['MSFT'] })).data).toMatchObject({ watchlist: 'Principal', added: ['MSFT'] })
  expect(itemsIn(box.state, 'Tech')).toEqual(['NVDA'])
})

test('Should refuse to change a watchlist deleted meanwhile instead of changing another one', async () => {
  const { api, box } = fakeApi({
    conflicts: 1,
    meanwhile: (state) => ({ ...state, watchlists: state.watchlists.filter((list) => list.id !== 'main'), activeWatchlistId: 'tech' }),
  })
  const { call } = await connect(api)
  expect(await call('add_section', { title: 'Semis' })).toMatchObject({
    failed: true,
    text: 'Principal was deleted while saving. Nothing was changed.',
  })
  expect(itemsIn(box.state, 'Tech')).toEqual(['NVDA'])
})

test('Should list who reports earnings in the coming week across every watchlist', async () => {
  const { api, box } = fakeApi()
  const { call } = await connect(api)
  expect((await call('get_earnings_calendar')).data).toEqual({
    from: '2026-11-24',
    to: '2026-12-01',
    entries: [
      { date: '2026-11-26', symbol: 'KO', name: 'Coca-Cola', watchlists: ['Principal'], kind: 'next', estimatedDate: false, timing: 'after the close' },
    ],
    stillLoading: 0,
  })
  expect(box.calendarAsked).toEqual([['KO', 'PEP', 'NVDA']])
})

test('Should list the earnings of one watchlist between two dates, past ones included', async () => {
  const { call } = await connect(fakeApi().api)
  const { data } = await call('get_earnings_calendar', { watchlist: 'Principal', from: '2026-10-01', to: '2026-12-31' })
  expect(data.entries.map((entry: { date: string; symbol: string; kind: string }) => [entry.date, entry.symbol, entry.kind])).toEqual([
    ['2026-10-21', 'KO', 'past'],
    ['2026-11-20', 'PEP', 'past'],
    ['2026-11-26', 'KO', 'next'],
  ])
})

test('Should refuse a day that does not exist on the calendar', async () => {
  const { call } = await connect(fakeApi().api)
  expect((await call('get_earnings_calendar', { from: '2026-13-01', to: '2026-13-31' })).failed).toBe(true)
  expect((await call('get_earnings_calendar', { from: '2026-02-29' })).failed).toBe(true)
  expect((await call('get_earnings_calendar', { from: '2028-02-29' })).failed).toBe(false)
})

test('Should say how many dates doji is still fetching', async () => {
  const { call } = await connect(fakeApi({ pendingEarnings: 40 }).api)
  const { data } = await call('get_earnings_calendar')
  expect(data.stillLoading).toBe(40)
  expect(data.message).toBe('doji is still fetching 40 earnings dates. Ask again in a minute for the full list.')
})
