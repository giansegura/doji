import { expect, test } from 'vitest'
import { type AppState, DEFAULT_STATE, type SymbolInfo, type TrendLine } from '../../shared/types'
import { activeWatchlist, appReducer } from './appReducer'

const info = (symbol: string): SymbolInfo => ({ symbol, name: `${symbol} Inc.`, exchange: 'NYSE' })

const line = (id: string): TrendLine => ({
  id,
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2026-11-02', value: 1 },
  p2: { date: '2026-11-20', value: 2 },
  color: '#2962FF',
  width: 2,
  extendRight: false,
  pricedAt: '2026-11-23',
})

const base: AppState = {
  ...DEFAULT_STATE,
  watchlists: [
    { id: 'main', name: 'Principal', items: ['A', 'B', 'C', 'D'].map(info) },
    { id: 'other', name: 'Otra', items: ['X', 'Y'].map(info) },
  ],
  activeWatchlistId: 'main',
  lines: { MSFT: [line('m')] },
}

const symbols = (state: AppState): string[] => activeWatchlist(state).items.map((item) => item.symbol)

const names = (state: AppState): string[] => state.watchlists.map((list) => list.name)

test('Should add a new symbol at the end of the watchlist', () => {
  expect(symbols(appReducer(base, { type: 'addToWatchlist', info: info('KO') }))).toEqual(['A', 'B', 'C', 'D', 'KO'])
})

test('Should not add a symbol twice to the watchlist', () => {
  const out = appReducer(base, { type: 'addToWatchlist', info: info('b') })
  expect(out).toBe(base)
})

test('Should remove a symbol and keep the order of the rest', () => {
  expect(symbols(appReducer(base, { type: 'removeFromWatchlist', symbol: 'B' }))).toEqual(['A', 'C', 'D'])
})

test('Should move a symbol within the watchlist', () => {
  expect(symbols(appReducer(base, { type: 'moveInWatchlist', from: 0, to: 2 }))).toEqual(['B', 'C', 'A', 'D'])
  expect(symbols(appReducer(base, { type: 'moveInWatchlist', from: 3, to: 0 }))).toEqual(['D', 'A', 'B', 'C'])
})

test('Should ignore a move outside the list or onto itself', () => {
  expect(appReducer(base, { type: 'moveInWatchlist', from: 9, to: 0 })).toBe(base)
  expect(appReducer(base, { type: 'moveInWatchlist', from: 0, to: -1 })).toBe(base)
  expect(appReducer(base, { type: 'moveInWatchlist', from: 1, to: 1 })).toBe(base)
})

test('Should only touch the active list when adding, removing or moving', () => {
  const out = [
    { type: 'addToWatchlist', info: info('KO') } as const,
    { type: 'removeFromWatchlist', symbol: 'A' } as const,
    { type: 'moveInWatchlist', from: 0, to: 1 } as const,
  ].reduce(appReducer, base)
  expect(symbols(out)).toEqual(['C', 'B', 'D', 'KO'])
  expect(out.watchlists[1]).toBe(base.watchlists[1])
})

test('Should add to the other list once it is the active one', () => {
  const switched = appReducer(base, { type: 'selectWatchlist', id: 'other' })
  const out = appReducer(switched, { type: 'addToWatchlist', info: info('A') })
  expect(symbols(out)).toEqual(['X', 'Y', 'A'])
  expect(out.watchlists[0]).toBe(base.watchlists[0])
})

test('Should create an empty list and make it the active one', () => {
  const out = appReducer(base, { type: 'createWatchlist', id: 'new', name: '  Bancos  ' })
  expect(names(out)).toEqual(['Principal', 'Otra', 'Bancos'])
  expect(out.activeWatchlistId).toBe('new')
  expect(symbols(out)).toEqual([])
})

test('Should not create a list without a name, with a used id or beyond twenty', () => {
  expect(appReducer(base, { type: 'createWatchlist', id: 'new', name: '   ' })).toBe(base)
  expect(appReducer(base, { type: 'createWatchlist', id: 'main', name: 'Repetida' })).toBe(base)
  const full: AppState = {
    ...base,
    watchlists: Array.from({ length: 20 }, (_, index) => ({ id: `l${index}`, name: `Lista ${index}`, items: [] })),
    activeWatchlistId: 'l0',
  }
  expect(appReducer(full, { type: 'createWatchlist', id: 'new', name: 'Una más' })).toBe(full)
})

test('Should duplicate a list right after the original and make the copy active', () => {
  const out = appReducer(base, { type: 'duplicateWatchlist', id: 'main', newId: 'copy' })
  expect(names(out)).toEqual(['Principal', 'Principal (copia)', 'Otra'])
  expect(out.activeWatchlistId).toBe('copy')
  expect(symbols(out)).toEqual(['A', 'B', 'C', 'D'])
  expect(out.watchlists[0]).toBe(base.watchlists[0])
})

test('Should keep the copy independent from the original', () => {
  const copied = appReducer(base, { type: 'duplicateWatchlist', id: 'main', newId: 'copy' })
  const out = appReducer(copied, { type: 'removeFromWatchlist', symbol: 'A' })
  expect(symbols(out)).toEqual(['B', 'C', 'D'])
  expect(out.watchlists[0].items.map((item) => item.symbol)).toEqual(['A', 'B', 'C', 'D'])
})

test('Should number the copy when the name is already taken', () => {
  const once = appReducer(base, { type: 'duplicateWatchlist', id: 'main', newId: 'copy1' })
  const twice = appReducer(once, { type: 'duplicateWatchlist', id: 'main', newId: 'copy2' })
  expect(names(twice)).toEqual(['Principal', 'Principal (copia 2)', 'Principal (copia)', 'Otra'])
})

test('Should keep the name of a copy within forty characters', () => {
  const long: AppState = { ...base, watchlists: [{ id: 'main', name: 'N'.repeat(40), items: [] }] }
  const out = appReducer(long, { type: 'duplicateWatchlist', id: 'main', newId: 'copy' })
  expect(out.watchlists[1].name).toBe(`${'N'.repeat(32)} (copia)`)
  expect(out.watchlists[1].name).toHaveLength(40)
})

test('Should not duplicate an unknown list, reuse an id or go beyond twenty lists', () => {
  expect(appReducer(base, { type: 'duplicateWatchlist', id: 'zzz', newId: 'copy' })).toBe(base)
  expect(appReducer(base, { type: 'duplicateWatchlist', id: 'main', newId: 'other' })).toBe(base)
  const full: AppState = {
    ...base,
    watchlists: Array.from({ length: 20 }, (_, index) => ({ id: `l${index}`, name: `Lista ${index}`, items: [] })),
    activeWatchlistId: 'l0',
  }
  expect(appReducer(full, { type: 'duplicateWatchlist', id: 'l0', newId: 'copy' })).toBe(full)
})

test('Should rename a list', () => {
  const out = appReducer(base, { type: 'renameWatchlist', id: 'other', name: ' Consumo ' })
  expect(names(out)).toEqual(['Principal', 'Consumo'])
  expect(out.watchlists[1].items).toBe(base.watchlists[1].items)
})

test('Should ignore a blank or unchanged name and an unknown list', () => {
  expect(appReducer(base, { type: 'renameWatchlist', id: 'other', name: '  ' })).toBe(base)
  expect(appReducer(base, { type: 'renameWatchlist', id: 'other', name: 'Otra' })).toBe(base)
  expect(appReducer(base, { type: 'renameWatchlist', id: 'zzz', name: 'Nueva' })).toBe(base)
})

test('Should delete a list that is not the active one', () => {
  const out = appReducer(base, { type: 'deleteWatchlist', id: 'other' })
  expect(names(out)).toEqual(['Principal'])
  expect(out.activeWatchlistId).toBe('main')
})

test('Should activate the neighbouring list when the active one is deleted', () => {
  const three: AppState = { ...base, watchlists: [...base.watchlists, { id: 'third', name: 'Tercera', items: [] }], activeWatchlistId: 'other' }
  expect(appReducer(three, { type: 'deleteWatchlist', id: 'other' }).activeWatchlistId).toBe('main')
  expect(appReducer(base, { type: 'deleteWatchlist', id: 'main' }).activeWatchlistId).toBe('other')
})

test('Should never delete the last list or an unknown one', () => {
  const single: AppState = { ...base, watchlists: [base.watchlists[0]] }
  expect(appReducer(single, { type: 'deleteWatchlist', id: 'main' })).toBe(single)
  expect(appReducer(base, { type: 'deleteWatchlist', id: 'zzz' })).toBe(base)
})

test('Should switch lists and ignore an unknown or already active one', () => {
  expect(symbols(appReducer(base, { type: 'selectWatchlist', id: 'other' }))).toEqual(['X', 'Y'])
  expect(appReducer(base, { type: 'selectWatchlist', id: 'zzz' })).toBe(base)
  expect(appReducer(base, { type: 'selectWatchlist', id: 'main' })).toBe(base)
})

test('Should fall back to the first list when the active id is unknown', () => {
  expect(activeWatchlist({ ...base, activeWatchlistId: 'zzz' })).toBe(base.watchlists[0])
})

test('Should replace only the lines of the given symbol', () => {
  const out = appReducer(base, { type: 'setLines', symbol: 'AAPL', lines: [line('a')] })
  expect(out.lines).toEqual({ MSFT: [line('m')], AAPL: [line('a')] })
})

test('Should drop the entry when a symbol is left without lines', () => {
  const out = appReducer(base, { type: 'setLines', symbol: 'MSFT', lines: [] })
  expect(out.lines).toEqual({})
})

test('Should upper-case and trim the symbol when it changes', () => {
  expect(appReducer(base, { type: 'setSymbol', symbol: ' ko ' }).symbol).toBe('KO')
})

test('Should ignore an empty or unchanged symbol', () => {
  expect(appReducer(base, { type: 'setSymbol', symbol: '  ' })).toBe(base)
  expect(appReducer(base, { type: 'setSymbol', symbol: 'aapl' })).toBe(base)
})

test('Should change theme, timeframe and indicators', () => {
  const indicators = { volume: { visible: false }, rsi: { visible: true, length: 21, showMa: false }, sma: [{ id: 'a', length: 20, color: '#FF9800', width: 2 }] }
  const out = [
    { type: 'setTheme', theme: 'light' } as const,
    { type: 'setTimeframe', timeframe: 'W' } as const,
    { type: 'setIndicators', indicators } as const,
  ].reduce(appReducer, base)
  expect([out.theme, out.timeframe, out.indicators]).toEqual(['light', 'W', indicators])
})

test('Should change the chart settings', () => {
  const chart = { type: 'line', scale: 'log', invert: true, cursor: 'magnet' } as const
  expect(appReducer(base, { type: 'setChart', chart }).chart).toEqual(chart)
})

test('Should keep the same state when nothing changes', () => {
  expect(appReducer(base, { type: 'setTheme', theme: 'dark' })).toBe(base)
  expect(appReducer(base, { type: 'setTimeframe', timeframe: 'D' })).toBe(base)
  expect(appReducer(base, { type: 'removeFromWatchlist', symbol: 'ZZZ' })).toBe(base)
})

test('Should replace everything with an imported configuration and keep its own revision', () => {
  const config: AppState = {
    ...DEFAULT_STATE,
    rev: 3,
    theme: 'light',
    symbol: 'KO',
    timeframe: 'W',
    watchlists: [{ id: 'otra', name: 'Importada', items: [info('KO')] }],
    activeWatchlistId: 'otra',
    lines: { KO: [line('l1')] },
  }
  expect(appReducer({ ...base, rev: 12 }, { type: 'importConfig', config })).toEqual({ ...config, rev: 12 })
})
