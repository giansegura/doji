import { expect, test } from 'vitest'
import { normalizeState } from './normalizeState'
import { DEFAULT_STATE, type TrendLine } from './types'

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

test('Should read a revision of at least one', () => {
  expect(normalizeState({ rev: 7 }).rev).toBe(7)
  expect(normalizeState({ rev: 0 }).rev).toBe(1)
  expect(normalizeState({ rev: 'x' }).rev).toBe(1)
  expect(normalizeState({ rev: 2.5 }).rev).toBe(1)
})
