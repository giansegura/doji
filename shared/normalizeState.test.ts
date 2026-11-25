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
  expect(out.watchlists).toEqual([{ id: 'default', name: 'Watchlist', items: [{ symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }] }])
  expect(out.activeWatchlistId).toBe('default')
  expect(out.timeframe).toBe('D')
  expect(out.symbol).toBe('AAPL')
  expect(out.indicators).toEqual(DEFAULT_STATE.indicators)
  expect(out.lines).toEqual({})
})

test('Should keep an empty watchlist the user left empty', () => {
  expect(normalizeState({ watchlist: [] }).watchlists).toEqual([{ id: 'default', name: 'Watchlist', items: [] }])
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
    { id: 'a', name: 'Watchlist', items: [ko] },
    { id: 'b', name: 'Watchlist', items: [] },
  ])
})

test('Should fall back to the default list when no list is usable', () => {
  expect(normalizeState({ watchlists: [] }).watchlists).toEqual(DEFAULT_STATE.watchlists)
  expect(normalizeState({ watchlists: [{ name: 'sin id' }] }).watchlists).toEqual(DEFAULT_STATE.watchlists)
})

test('Should keep at most twenty lists', () => {
  const many = Array.from({ length: 25 }, (_, index) => ({ id: `l${index}`, name: `List ${index}`, items: [] }))
  expect(normalizeState({ watchlists: many }).watchlists).toHaveLength(20)
})

test('Should fill in missing indicator settings one by one', () => {
  const out = normalizeState({ indicators: { rsi: { length: 21, visible: 'yes' }, volume: { visible: false } } })
  expect(out.indicators).toEqual({
    ...DEFAULT_STATE.indicators,
    volume: { visible: false },
    rsi: { visible: true, length: 21, showMa: true },
  })
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

test('Should keep a usable list width and repair the rest', () => {
  expect(normalizeState({ listWidth: 400 }).listWidth).toBe(400)
  expect(normalizeState({ listWidth: 300.6 }).listWidth).toBe(301)
  expect(normalizeState({ listWidth: 100 }).listWidth).toBe(220)
  expect(normalizeState({ listWidth: 5000 }).listWidth).toBe(640)
  expect(normalizeState({ listWidth: 'ancha' }).listWidth).toBe(DEFAULT_STATE.listWidth)
  expect(normalizeState({}).listWidth).toBe(400)
})

test('Should accept the monthly timeframe for the chart and for lines', () => {
  const out = normalizeState({ timeframe: 'M', lines: { KO: [{ ...validLine, timeframe: 'M' }] } })
  expect(out.timeframe).toBe('M')
  expect(out.lines.KO[0].timeframe).toBe('M')
  expect(normalizeState({ timeframe: 'Y' }).timeframe).toBe(DEFAULT_STATE.timeframe)
})

const hline = {
  kind: 'hline',
  id: 'h',
  pane: 'price',
  timeframe: 'D',
  value: 210.5,
  color: '#F23645',
  width: 3,
  pricedAt: '2026-11-21',
}

const channel = {
  kind: 'channel',
  id: 'c',
  pane: 'price',
  timeframe: 'W',
  p1: { date: '2026-11-02', value: 200 },
  p2: { date: '2026-11-20', value: 230 },
  offset: -12.5,
  color: '#F23645',
  width: 3,
  pricedAt: '2026-11-21',
}

const rect = {
  kind: 'rect',
  id: 'r',
  pane: 'rsi',
  timeframe: 'D',
  p1: { date: '2026-11-02', value: 30 },
  p2: { date: '2026-11-20', value: 45 },
  color: '#F23645',
  width: 3,
  pricedAt: '2026-11-21',
}

test('Should keep horizontal lines, channels and rectangles next to trend lines', () => {
  const out = normalizeState({ lines: { KO: [validLine, hline, channel, rect] } })
  expect(out.lines.KO).toEqual([validLine, hline, channel, rect])
})

test('Should drop the new drawings that lack what they need', () => {
  const broken = [
    { ...hline, value: 'alto' },
    { ...hline, id: '' },
    { ...channel, offset: undefined },
    { ...channel, p2: { date: 'ayer', value: 1 } },
    { ...rect, p1: undefined },
    { ...rect, pane: 'volumen' },
    { ...validLine, kind: 'circle' },
  ]
  expect(normalizeState({ lines: { KO: [...broken, hline] } }).lines.KO).toEqual([hline])
})

test('Should complete the style of the new drawings like it does for lines', () => {
  const bare = { kind: 'hline', id: 'h', pane: 'price', value: 10 }
  expect(normalizeState({ lines: { KO: [bare] } }).lines.KO).toEqual([
    { kind: 'hline', id: 'h', pane: 'price', timeframe: 'D', value: 10, color: '#2962FF', width: 2, pricedAt: '9999-12-31' },
  ])
})

test('Should keep the dash, the opacity and the hidden price of a line', () => {
  const styled = { ...hline, lineStyle: 'dashed', opacity: 0.45, hidePrice: true }
  const dotted = { ...rect, lineStyle: 'dotted', opacity: 0.8 }
  expect(normalizeState({ lines: { KO: [styled, dotted] } }).lines.KO).toEqual([styled, dotted])
})

test('Should leave a line solid, fully opaque and with its price when those settings cannot be read', () => {
  const odd = { ...hline, lineStyle: 'wavy', opacity: 7, hidePrice: 'yes' }
  const faint = { ...hline, id: 'f', opacity: 0 }
  const plain = { ...hline, id: 'p', lineStyle: 'solid', opacity: 1, hidePrice: false }
  const onTrend = { ...validLine, hidePrice: true }
  expect(normalizeState({ lines: { KO: [odd, faint, plain, onTrend] } }).lines.KO).toEqual([
    hline,
    { ...hline, id: 'f' },
    { ...hline, id: 'p' },
    validLine,
  ])
})

test('Should keep a trend line that says it is one, without the mark', () => {
  expect(normalizeState({ lines: { KO: [{ ...validLine, kind: 'trend' }] } }).lines.KO).toEqual([validLine])
})

test('Should keep the sections of a list between its symbols', () => {
  const items = [
    { kind: 'section', id: 's1', title: 'En cartera' },
    { symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' },
    { kind: 'section', id: 's2', title: 'Vigilando' },
  ]
  const out = normalizeState({ watchlists: [{ id: 'a', name: 'Mía', items }] })
  expect(out.watchlists[0].items).toEqual(items)
})

test('Should drop sections without id or title and trim the title', () => {
  const items = [
    { kind: 'section', id: '', title: 'Sin id' },
    { kind: 'section', id: 's1', title: '   ' },
    { kind: 'section', id: 's2', title: `  ${'x'.repeat(60)}  ` },
  ]
  const out = normalizeState({ watchlists: [{ id: 'a', name: 'Mía', items }] })
  expect(out.watchlists[0].items).toEqual([{ kind: 'section', id: 's2', title: 'x'.repeat(40) }])
})

test('Should keep the notes of each symbol and drop what is not a note', () => {
  const out = normalizeState({ notes: { KO: 'Comprar por debajo de 60', PEP: '', MSFT: 7, NVDA: 'x'.repeat(6000) } })
  expect(out.notes).toEqual({ KO: 'Comprar por debajo de 60', NVDA: 'x'.repeat(5000) })
  expect(normalizeState({}).notes).toEqual({})
  expect(normalizeState({ notes: ['KO'] }).notes).toEqual({})
})

test('Should give an older state the new indicators switched off with their usual settings', () => {
  const out = normalizeState({ indicators: { volume: { visible: true } } })
  expect(out.indicators.volumeMa).toEqual({ visible: false, length: 20 })
  expect(out.indicators.bollinger).toEqual({ visible: false, length: 20, multiplier: 2 })
  expect(out.indicators.macd).toEqual({ visible: false, fast: 12, slow: 26, signal: 9 })
})

test('Should keep the settings of the new indicators and repair them one by one', () => {
  const out = normalizeState({
    indicators: {
      volumeMa: { visible: true, length: 50 },
      bollinger: { visible: true, length: 0, multiplier: 2.5 },
      macd: { visible: true, fast: 'rápido', slow: 30, signal: 9000 },
    },
  })
  expect(out.indicators.volumeMa).toEqual({ visible: true, length: 50 })
  expect(out.indicators.bollinger).toEqual({ visible: true, length: 20, multiplier: 2.5 })
  expect(out.indicators.macd).toEqual({ visible: true, fast: 12, slow: 30, signal: 9 })
  expect(normalizeState({ indicators: { bollinger: { multiplier: 40 } } }).indicators.bollinger.multiplier).toBe(2)
})

test('Should tell an exponential moving average from a simple one', () => {
  const sma = [
    { id: 'a', length: 20, color: '#FF9800', width: 1, kind: 'ema' },
    { id: 'b', length: 50, color: '#2962FF', width: 1 },
    { id: 'c', length: 100, color: '#2962FF', width: 1, kind: 'wma' },
  ]
  const out = normalizeState({ indicators: { sma } }).indicators.sma
  expect(out).toEqual([sma[0], sma[1], { id: 'c', length: 100, color: '#2962FF', width: 1 }])
})

test('Should keep the alert of the lines that carry one and nothing else as an alert', () => {
  const armedLine = { ...validLine, alert: true }
  const armedLevel = { ...hline, alert: true }
  const out = normalizeState({
    lines: { KO: [armedLine, armedLevel, { ...validLine, id: 'b', alert: false }, { ...hline, id: 'h2', alert: 'sí' }, { ...rect, alert: true }] },
  })
  expect(out.lines.KO).toEqual([armedLine, armedLevel, { ...validLine, id: 'b' }, { ...hline, id: 'h2' }, rect])
})

test('Should keep the timeframe of a second chart and have none by default', () => {
  expect(normalizeState({}).secondChart).toBeNull()
  expect(normalizeState({ secondChart: 'W' }).secondChart).toBe('W')
  expect(normalizeState({ secondChart: 'M' }).secondChart).toBe('M')
  expect(normalizeState({ secondChart: 'Y' }).secondChart).toBeNull()
  expect(normalizeState({ secondChart: true }).secondChart).toBeNull()
})

test('Should keep only the first of several sections that share an id within a list', () => {
  const items = [
    { kind: 'section', id: 's1', title: 'Primera' },
    { symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' },
    { kind: 'section', id: 's1', title: 'Repetida' },
  ]
  const out = normalizeState({ watchlists: [{ id: 'a', name: 'Una', items }, { id: 'b', name: 'Otra', items: [items[2]] }] })
  expect(out.watchlists[0].items).toEqual([items[0], items[1]])
  expect(out.watchlists[1].items).toEqual([items[2]])
})

test('Should keep how the watchlist is sorted and drop a sort it does not know', () => {
  expect(normalizeState({}).watchlistSort).toBeNull()
  expect(normalizeState({ watchlistSort: { column: 'change', direction: 'desc' } }).watchlistSort).toEqual({ column: 'change', direction: 'desc' })
  expect(normalizeState({ watchlistSort: { column: 'volume', direction: 'desc' } }).watchlistSort).toBeNull()
  expect(normalizeState({ watchlistSort: { column: 'last', direction: 'up' } }).watchlistSort).toBeNull()
})

test('Should keep each known theme and open new configurations with the doji theme', () => {
  expect(normalizeState({ theme: 'doji' }).theme).toBe('doji')
  expect(normalizeState({ theme: 'midnight' }).theme).toBe('midnight')
  expect(normalizeState({ theme: 'light' }).theme).toBe('light')
  expect(normalizeState({}).theme).toBe('doji')
  expect(normalizeState({ theme: 'sepia' }).theme).toBe('doji')
})

test('Should keep the look of a configuration saved with the former dark theme', () => {
  expect(normalizeState({ theme: 'dark' }).theme).toBe('midnight')
})

test('Should open with the doji theme a configuration whose theme names a built-in property of objects', () => {
  expect(normalizeState({ theme: 'constructor' }).theme).toBe('doji')
  expect(normalizeState({ theme: '__proto__' }).theme).toBe('doji')
  expect(normalizeState({ theme: 'toString' }).theme).toBe('doji')
})

test('Should keep the icon of a watchlist and drop one that is not valid', () => {
  const lists = normalizeState({
    watchlists: [
      { id: 'a', name: 'Bancos', icon: '🏦', items: [] },
      { id: 'b', name: 'Otra', icon: '   ', items: [] },
      { id: 'c', name: 'Tercera', icon: 42, items: [] },
    ],
  }).watchlists
  expect(lists.map((list) => list.icon)).toEqual(['🏦', undefined, undefined])
  expect('icon' in lists[1]).toBe(false)
})

test('Should keep the look remembered for each kind of drawing and drop what it cannot read', () => {
  const lineLooks = {
    hline: { color: '#FFFFFF', width: 1, lineStyle: 'dashed', opacity: 0.5, hidePrice: true },
    trend: { color: '#F23645', width: 3, hidePrice: true },
    channel: { color: 'blue', width: 9 },
    circle: { color: '#FFFFFF', width: 1 },
  }
  expect(normalizeState({ lineLooks }).lineLooks).toEqual({
    hline: { color: '#FFFFFF', width: 1, lineStyle: 'dashed', opacity: 0.5, hidePrice: true },
    trend: { color: '#F23645', width: 3 },
  })
  expect(normalizeState({}).lineLooks).toEqual({})
})

test('Should keep the text of a line, trimmed and no longer than sixty characters', () => {
  const long = 'x'.repeat(80)
  const out = normalizeState({
    lines: {
      KO: [
        { ...hline, text: '  Soporte semanal  ' },
        { ...hline, id: 'l', text: long },
        { ...hline, id: 'e', text: '   ' },
        { ...validLine, text: 'R1' },
        { ...rect, text: 'caja' },
      ],
    },
  }).lines.KO
  expect(out.map((drawing) => ('text' in drawing ? drawing.text : undefined))).toEqual([
    'Soporte semanal',
    'x'.repeat(60),
    undefined,
    'R1',
    undefined,
  ])
})

test('Should keep the volume profile hidden with twenty-four rows unless the configuration says otherwise', () => {
  expect(normalizeState({}).indicators.volumeProfile).toEqual({ visible: false, rows: 24 })
  expect(normalizeState({ indicators: { volumeProfile: { visible: true, rows: 40 } } }).indicators.volumeProfile).toEqual({
    visible: true,
    rows: 40,
  })
  expect(normalizeState({ indicators: { volumeProfile: { visible: 'sí', rows: 500 } } }).indicators.volumeProfile).toEqual({
    visible: false,
    rows: 24,
  })
})

test('Should keep the support and resistance levels hidden with three per side unless the configuration says otherwise', () => {
  expect(normalizeState({}).indicators.levels).toEqual({ visible: false, perSide: 3 })
  expect(normalizeState({ indicators: { levels: { visible: true, perSide: 5 } } }).indicators.levels).toEqual({ visible: true, perSide: 5 })
  expect(normalizeState({ indicators: { levels: { visible: 1, perSide: 9 } } }).indicators.levels).toEqual({ visible: false, perSide: 3 })
  expect(normalizeState({ indicators: { levels: { visible: true, perSide: 0 } } }).indicators.levels).toEqual({ visible: true, perSide: 3 })
})
