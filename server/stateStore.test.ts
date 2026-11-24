import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { type AppState, DEFAULT_STATE, type TrendLine } from '../shared/types'
import { createStateStore, normalizeState } from './stateStore'

const validLine: TrendLine = {
  id: 'a',
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2026-11-02', value: 200 },
  p2: { date: '2026-11-20', value: 230 },
  color: '#F23645',
  width: 3,
  extendRight: true,
  pricedAt: '2026-11-21',
}

const makeStore = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-state-'))
  const file = join(dir, 'nested', 'state.json')
  let clock = new Date(2026, 10, 23, 12, 0, 0).getTime()
  const store = createStateStore(file, () => new Date(clock))
  const advanceDays = (days: number) => {
    clock += days * 24 * 60 * 60 * 1000
  }
  return { store, dir: join(dir, 'nested'), file, advanceDays }
}

test('Should return the defaults when the file does not exist', async () => {
  const { store } = await makeStore()
  expect(await store.read()).toEqual(DEFAULT_STATE)
})

test('Should round-trip a state through disk', async () => {
  const { store, dir } = await makeStore()
  const state: AppState = { ...DEFAULT_STATE, theme: 'light', symbol: 'KO', lines: { KO: [validLine] } }
  expect(await store.save(state, 1)).toEqual({ ok: true, rev: 2 })
  expect(await store.read()).toEqual({ ...state, rev: 2 })
  expect(await readdir(dir)).toEqual(['state.json'])
})

test('Should keep a copy of a corrupt file and fall back to defaults', async () => {
  const { store, dir, file } = await makeStore()
  await store.save(DEFAULT_STATE, 1)
  await writeFile(file, '{not json')
  expect(await store.read()).toEqual(DEFAULT_STATE)
  const copies = (await readdir(dir)).filter((name) => name.startsWith('state.json.corrupt-'))
  expect(copies).toHaveLength(1)
  expect(await readFile(join(dir, copies[0]), 'utf8')).toBe('{not json')
})

test('Should keep the valid parts of an older or partial state', () => {
  const out = normalizeState({
    theme: 'light',
    watchlist: [{ symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }, { name: 'sin símbolo' }],
    timeframe: 'X',
  })
  expect(out.theme).toBe('light')
  expect(out.watchlists).toEqual([{ id: 'default', name: 'Lista', items: [{ symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }] }])
  expect(out.activeWatchlistId).toBe('default')
  expect(out.timeframe).toBe('D')
  expect(out.symbol).toBe('AAPL')
  expect(out.indicators).toEqual(DEFAULT_STATE.indicators)
  expect(out.lines).toEqual({})
})

test('Should keep an empty watchlist the user left empty', () => {
  expect(normalizeState({ watchlist: [] }).watchlists).toEqual([{ id: 'default', name: 'Lista', items: [] }])
})

const ko = { symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }

test('Should keep several lists and the active one', () => {
  const watchlists = [
    { id: 'a', name: 'Tecnología', items: [] },
    { id: 'b', name: 'Consumo', items: [ko] },
  ]
  const out = normalizeState({ watchlists, activeWatchlistId: 'b' })
  expect(out.watchlists).toEqual(watchlists)
  expect(out.activeWatchlistId).toBe('b')
})

test('Should prefer the lists over the single list of an older state', () => {
  const out = normalizeState({ watchlist: [ko], watchlists: [{ id: 'a', name: 'Mía', items: [] }] })
  expect(out.watchlists).toEqual([{ id: 'a', name: 'Mía', items: [] }])
})

test('Should activate the first list when the active one does not exist', () => {
  const out = normalizeState({ watchlists: [{ id: 'a', name: 'Una', items: [] }], activeWatchlistId: 'zzz' })
  expect(out.activeWatchlistId).toBe('a')
})

test('Should drop lists without id, repeated ids and symbols without ticker', () => {
  const out = normalizeState({
    watchlists: [
      { name: 'sin id', items: [] },
      { id: 'a', items: [ko, { name: 'sin símbolo' }] },
      { id: 'a', name: 'repetida', items: [] },
      { id: 'b', name: '   ', items: 'no es una lista' },
      'basura',
    ],
  })
  expect(out.watchlists).toEqual([
    { id: 'a', name: 'Lista', items: [ko] },
    { id: 'b', name: 'Lista', items: [] },
  ])
})

test('Should fall back to the default list when no list is usable', () => {
  expect(normalizeState({ watchlists: [] }).watchlists).toEqual(DEFAULT_STATE.watchlists)
  expect(normalizeState({ watchlists: [{ name: 'sin id' }] }).watchlists).toEqual(DEFAULT_STATE.watchlists)
})

test('Should keep at most twenty lists', () => {
  const many = Array.from({ length: 25 }, (_, index) => ({ id: `l${index}`, name: `Lista ${index}`, items: [] }))
  expect(normalizeState({ watchlists: many }).watchlists).toHaveLength(20)
})

test('Should fill in missing indicator settings one by one', () => {
  const out = normalizeState({ indicators: { rsi: { length: 21, visible: 'yes' }, volume: { visible: false } } })
  expect(out.indicators).toEqual({ volume: { visible: false }, rsi: { visible: true, length: 21, showMa: true }, sma: [] })
})

test('Should reject an RSI length outside 2 to 100', () => {
  expect(normalizeState({ indicators: { rsi: { length: 500 } } }).indicators.rsi.length).toBe(14)
  expect(normalizeState({ indicators: { rsi: { length: 2.5 } } }).indicators.rsi.length).toBe(14)
})

test('Should keep valid moving averages and drop malformed ones', () => {
  const good = { id: 'a', length: 20, color: '#FF9800', width: 3 }
  const out = normalizeState({
    indicators: {
      sma: [good, { id: 'b', length: 0, color: '#000000' }, { length: 50, color: '#000000' }, 'x', { id: 'c', length: 50.5, color: '#000000' }, { id: 'd', length: 501, color: '#000000' }],
    },
  })
  expect(out.indicators.sma).toEqual([good])
})

test('Should give a moving average without colour the default one', () => {
  expect(normalizeState({ indicators: { sma: [{ id: 'a', length: 50 }] } }).indicators.sma).toEqual([
    { id: 'a', length: 50, color: '#FF9800', width: 1 },
  ])
})

test('Should fall back to the default colour and width when they are not usable', () => {
  const out = normalizeState({
    indicators: {
      sma: [
        { id: 'a', length: 50, color: 'rojo', width: 9 },
        { id: 'b', length: 20, color: '#abcdef', width: 2.5 },
      ],
    },
  })
  expect(out.indicators.sma).toEqual([
    { id: 'a', length: 50, color: '#FF9800', width: 1 },
    { id: 'b', length: 20, color: '#abcdef', width: 1 },
  ])
})

test('Should have no moving averages in a state saved before they existed', () => {
  const out = normalizeState({ indicators: { volume: { visible: true }, rsi: { visible: true, length: 14, showMa: true } } })
  expect(out.indicators.sma).toEqual([])
})

test('Should keep at most six moving averages', () => {
  const many = Array.from({ length: 9 }, (_, index) => ({ id: `s${index}`, length: 10 + index, color: '#FF9800' }))
  expect(normalizeState({ indicators: { sma: many } }).indicators.sma.map((item) => item.id)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5'])
})

test('Should drop malformed lines but keep good ones', () => {
  const out = normalizeState({
    lines: {
      AAPL: [validLine, { id: 'x' }, { ...validLine, id: 'b', p2: { date: 'ayer', value: 1 } }],
      MSFT: [{ id: 'y', pane: 'price' }],
      KO: 'no es una lista',
    },
  })
  expect(out.lines).toEqual({ AAPL: [validLine] })
})

test('Should complete a line that only lacks its style', () => {
  const { color, width, extendRight, pricedAt, timeframe, ...bare } = validLine
  const out = normalizeState({ lines: { AAPL: [bare] } })
  expect(out.lines.AAPL[0]).toEqual({
    ...bare,
    timeframe: 'D',
    color: '#2962FF',
    width: 2,
    extendRight: false,
    pricedAt: '9999-12-31',
  })
  expect([color, width, extendRight, pricedAt, timeframe]).toHaveLength(5)
})

test('Should return the defaults for non-object input', () => {
  expect(normalizeState(null)).toEqual(DEFAULT_STATE)
  expect(normalizeState('texto')).toEqual(DEFAULT_STATE)
  expect(normalizeState([1, 2])).toEqual(DEFAULT_STATE)
})

test('Should keep valid chart settings and default the rest one by one', () => {
  expect(normalizeState({}).chart).toEqual({ type: 'candles', scale: 'normal', invert: false, cursor: 'normal' })
  expect(normalizeState({ chart: { type: 'area', scale: 'percent', invert: true, cursor: 'magnetOhlc' } }).chart).toEqual({
    type: 'area',
    scale: 'percent',
    invert: true,
    cursor: 'magnetOhlc',
  })
  expect(normalizeState({ chart: { type: 'tarta', scale: 'log', invert: 'sí', cursor: 7 } }).chart).toEqual({
    type: 'candles',
    scale: 'log',
    invert: false,
    cursor: 'normal',
  })
})

test('Should refuse a save based on an older revision and keep what is on disk', async () => {
  const { store } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  expect(await store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, 1)).toEqual({ ok: false, reason: 'conflict' })
  expect((await store.read()).symbol).toBe('KO')
})

test('Should accept only the first of several saves made from the same revision', async () => {
  const { store, dir } = await makeStore()
  const states = ['AAPL', 'MSFT', 'KO', 'NVDA'].map((symbol) => ({ ...DEFAULT_STATE, symbol }))
  const outcomes = await Promise.all(states.map((state) => store.save(state, 1)))
  expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, false, false])
  expect((await store.read()).symbol).toBe('AAPL')
  expect(await readdir(dir)).toEqual(['state.json'])
})

test('Should accept a chain of saves each based on the previous one', async () => {
  const { store } = await makeStore()
  const first = await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  const second = await store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, first.ok ? first.rev : -1)
  expect(second).toEqual({ ok: true, rev: 3 })
  expect((await store.read()).symbol).toBe('MSFT')
})

test('Should normalise what it saves', async () => {
  const { store } = await makeStore()
  await store.save({ theme: 'light', basura: true } as unknown as AppState, 1)
  expect(await store.read()).toEqual({ ...DEFAULT_STATE, theme: 'light', rev: 2 })
})

test('Should read a revision of at least one', () => {
  expect(normalizeState({ rev: 7 }).rev).toBe(7)
  expect(normalizeState({ rev: 0 }).rev).toBe(1)
  expect(normalizeState({ rev: 'x' }).rev).toBe(1)
  expect(normalizeState({ rev: 2.5 }).rev).toBe(1)
})

test('Should fail loudly instead of returning defaults when the file cannot be read', async () => {
  const { store, file } = await makeStore()
  await mkdir(file, { recursive: true })
  await expect(store.read()).rejects.toThrow()
  await expect(store.save(DEFAULT_STATE, 1)).rejects.toThrow()
  await rm(file, { recursive: true })
})

test('Should keep one backup per day of the file as it was before the first save of that day', async () => {
  const { store, dir, advanceDays } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  await store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, 2)
  expect(await readdir(dir)).toEqual(['state.json'])
  advanceDays(1)
  await store.save({ ...DEFAULT_STATE, symbol: 'NVDA' }, 3)
  await store.save({ ...DEFAULT_STATE, symbol: 'AAPL' }, 4)
  expect((await readdir(dir)).sort()).toEqual(['state.json', 'state.json.bak-2026-11-24'])
  const backup = JSON.parse(await readFile(join(dir, 'state.json.bak-2026-11-24'), 'utf8')) as AppState
  expect(backup.symbol).toBe('MSFT')
})

test('Should keep only the seven most recent backups', async () => {
  const { store, dir, advanceDays } = await makeStore()
  await store.save(DEFAULT_STATE, 1)
  for (let day = 0; day < 10; day += 1) {
    advanceDays(1)
    await store.save(DEFAULT_STATE, day + 2)
  }
  const backups = (await readdir(dir)).filter((name) => name.includes('.bak-')).sort()
  expect(backups).toHaveLength(7)
  expect(backups[0]).toBe('state.json.bak-2026-11-27')
  expect(backups[6]).toBe('state.json.bak-2026-12-03')
})
