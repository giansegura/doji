import { expect, test } from 'vitest'
import { type AppState, DEFAULT_STATE, type SymbolInfo, type TrendLine } from '../../shared/types'
import { symbolsOf } from '../../shared/listItems'
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

const symbols = (state: AppState): string[] => symbolsOf(activeWatchlist(state).items).map((item) => item.symbol)

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
    watchlists: Array.from({ length: 20 }, (_, index) => ({ id: `l${index}`, name: `List ${index}`, items: [] })),
    activeWatchlistId: 'l0',
  }
  expect(appReducer(full, { type: 'createWatchlist', id: 'new', name: 'Una más' })).toBe(full)
})

test('Should duplicate a list right after the original and make the copy active', () => {
  const out = appReducer(base, { type: 'duplicateWatchlist', id: 'main', newId: 'copy' })
  expect(names(out)).toEqual(['Principal', 'Principal (copy)', 'Otra'])
  expect(out.activeWatchlistId).toBe('copy')
  expect(symbols(out)).toEqual(['A', 'B', 'C', 'D'])
  expect(out.watchlists[0]).toBe(base.watchlists[0])
})

test('Should keep the copy independent from the original', () => {
  const copied = appReducer(base, { type: 'duplicateWatchlist', id: 'main', newId: 'copy' })
  const out = appReducer(copied, { type: 'removeFromWatchlist', symbol: 'A' })
  expect(symbols(out)).toEqual(['B', 'C', 'D'])
  expect(symbolsOf(out.watchlists[0].items).map((item) => item.symbol)).toEqual(['A', 'B', 'C', 'D'])
})

test('Should number the copy when the name is already taken', () => {
  const once = appReducer(base, { type: 'duplicateWatchlist', id: 'main', newId: 'copy1' })
  const twice = appReducer(once, { type: 'duplicateWatchlist', id: 'main', newId: 'copy2' })
  expect(names(twice)).toEqual(['Principal', 'Principal (copy 2)', 'Principal (copy)', 'Otra'])
})

test('Should keep the name of a copy within forty characters', () => {
  const long: AppState = { ...base, watchlists: [{ id: 'main', name: 'N'.repeat(40), items: [] }] }
  const out = appReducer(long, { type: 'duplicateWatchlist', id: 'main', newId: 'copy' })
  expect(out.watchlists[1].name).toBe(`${'N'.repeat(33)} (copy)`)
  expect(out.watchlists[1].name).toHaveLength(40)
})

test('Should not duplicate an unknown list, reuse an id or go beyond twenty lists', () => {
  expect(appReducer(base, { type: 'duplicateWatchlist', id: 'zzz', newId: 'copy' })).toBe(base)
  expect(appReducer(base, { type: 'duplicateWatchlist', id: 'main', newId: 'other' })).toBe(base)
  const full: AppState = {
    ...base,
    watchlists: Array.from({ length: 20 }, (_, index) => ({ id: `l${index}`, name: `List ${index}`, items: [] })),
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
  const indicators = {
    ...DEFAULT_STATE.indicators,
    volume: { visible: false },
    rsi: { visible: true, length: 21, showMa: false },
    sma: [{ id: 'a', length: 20, color: '#FF9800', width: 2 }],
  }
  const out = [
    { type: 'setTheme', theme: 'light' } as const,
    { type: 'setTimeframe', timeframe: 'W' } as const,
    { type: 'setIndicators', indicators } as const,
  ].reduce(appReducer, base)
  expect([out.theme, out.timeframe, out.indicators]).toEqual(['light', 'W', indicators])
})

test('Should change the chart settings', () => {
  const chart = { type: 'line', scale: 'log', invert: true, cursor: 'magnet', currency: 'EUR' } as const
  expect(appReducer(base, { type: 'setChart', chart }).chart).toEqual(chart)
})

test('Should keep the same state when nothing changes', () => {
  expect(appReducer(base, { type: 'setTheme', theme: 'doji' })).toBe(base)
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

test('Should set the width of the list within its limits', () => {
  expect(appReducer(base, { type: 'setListWidth', width: 412 }).listWidth).toBe(412)
  expect(appReducer(base, { type: 'setListWidth', width: 90 }).listWidth).toBe(220)
  expect(appReducer(base, { type: 'setListWidth', width: 2000 }).listWidth).toBe(640)
  expect(appReducer(base, { type: 'setListWidth', width: 350.4 }).listWidth).toBe(350)
})

test('Should keep the same state when the width of the list does not change', () => {
  const sized = appReducer(base, { type: 'setListWidth', width: 400 })
  expect(appReducer(sized, { type: 'setListWidth', width: 400 })).toBe(sized)
  expect(appReducer(sized, { type: 'setListWidth', width: 400.3 })).toBe(sized)
})

const sectioned: AppState = {
  ...base,
  watchlists: [
    {
      id: 'main',
      name: 'Principal',
      items: [info('A'), { kind: 'section', id: 's1', title: 'Vigilando' }, info('B')],
    },
  ],
  activeWatchlistId: 'main',
}

test('Should add a section at the end of the active list', () => {
  const out = appReducer(base, { type: 'addSection', id: 's9', title: '  En cartera  ' })
  expect(activeWatchlist(out).items.at(-1)).toEqual({ kind: 'section', id: 's9', title: 'En cartera' })
  expect(activeWatchlist(out).items).toHaveLength(activeWatchlist(base).items.length + 1)
})

test('Should not add a section without title or with an id already in the list', () => {
  expect(appReducer(base, { type: 'addSection', id: 's9', title: '   ' })).toBe(base)
  expect(appReducer(sectioned, { type: 'addSection', id: 's1', title: 'Otra' })).toBe(sectioned)
})

test('Should rename and remove a section and leave the symbols where they are', () => {
  const renamed = appReducer(sectioned, { type: 'renameSection', id: 's1', title: 'En cartera' })
  expect(activeWatchlist(renamed).items[1]).toEqual({ kind: 'section', id: 's1', title: 'En cartera' })
  expect(appReducer(sectioned, { type: 'renameSection', id: 's1', title: '  ' })).toBe(sectioned)
  expect(appReducer(sectioned, { type: 'renameSection', id: 'zz', title: 'Nada' })).toBe(sectioned)
  const removed = appReducer(sectioned, { type: 'removeSection', id: 's1' })
  expect(activeWatchlist(removed).items).toEqual([info('A'), info('B')])
  expect(appReducer(sectioned, { type: 'removeSection', id: 'zz' })).toBe(sectioned)
})

test('Should move symbols and sections alike when a row is dragged', () => {
  const out = appReducer(sectioned, { type: 'moveInWatchlist', from: 1, to: 0 })
  expect(activeWatchlist(out).items).toEqual([{ kind: 'section', id: 's1', title: 'Vigilando' }, info('A'), info('B')])
})

test('Should tell a symbol already in the list from a section when adding or removing', () => {
  expect(appReducer(sectioned, { type: 'addToWatchlist', info: info('B') })).toBe(sectioned)
  const removed = appReducer(sectioned, { type: 'removeFromWatchlist', symbol: 'A' })
  expect(activeWatchlist(removed).items).toEqual([{ kind: 'section', id: 's1', title: 'Vigilando' }, info('B')])
})

test('Should write, replace and clear the note of a symbol', () => {
  const written = appReducer(base, { type: 'setNote', symbol: 'KO', text: 'Comprar por debajo de 60' })
  expect(written.notes).toEqual({ KO: 'Comprar por debajo de 60' })
  const replaced = appReducer(written, { type: 'setNote', symbol: 'KO', text: 'Vendida' })
  expect(replaced.notes).toEqual({ KO: 'Vendida' })
  expect(appReducer(replaced, { type: 'setNote', symbol: 'KO', text: '' }).notes).toEqual({})
  expect(appReducer(replaced, { type: 'setNote', symbol: 'KO', text: 'Vendida' })).toBe(replaced)
  expect(appReducer(base, { type: 'setNote', symbol: 'KO', text: '' })).toBe(base)
})

test('Should open a second chart on the other usual timeframe and close it again', () => {
  const daily = appReducer({ ...base, timeframe: 'D', secondChart: null }, { type: 'toggleSecondChart' })
  expect(daily.secondChart).toBe('W')
  expect(appReducer(daily, { type: 'toggleSecondChart' }).secondChart).toBeNull()
  expect(appReducer({ ...base, timeframe: 'W', secondChart: null }, { type: 'toggleSecondChart' }).secondChart).toBe('D')
  expect(appReducer({ ...base, timeframe: 'M', secondChart: null }, { type: 'toggleSecondChart' }).secondChart).toBe('D')
})

test('Should change the timeframe of the second chart only while it is open', () => {
  const open = { ...base, secondChart: 'W' as const }
  expect(appReducer(open, { type: 'setSecondChart', timeframe: 'M' }).secondChart).toBe('M')
  expect(appReducer(open, { type: 'setSecondChart', timeframe: 'W' })).toBe(open)
  const closed = { ...base, secondChart: null }
  expect(appReducer(closed, { type: 'setSecondChart', timeframe: 'M' })).toBe(closed)
})

test('Should sort the watchlist and stop sorting it', () => {
  const sortedBy = appReducer(base, { type: 'setWatchlistSort', sort: { column: 'change', direction: 'desc' } })
  expect(sortedBy.watchlistSort).toEqual({ column: 'change', direction: 'desc' })
  expect(appReducer(sortedBy, { type: 'setWatchlistSort', sort: null }).watchlistSort).toBeNull()
  expect(activeWatchlist(sortedBy).items).toEqual(activeWatchlist(base).items)
})

test('Should put an icon on a watchlist, change it and take it away', () => {
  const id = base.watchlists[0].id
  const withIcon = appReducer(base, { type: 'setWatchlistIcon', id, icon: '🏦' })
  expect(withIcon.watchlists[0].icon).toBe('🏦')
  expect(appReducer(withIcon, { type: 'setWatchlistIcon', id, icon: '🏦' })).toBe(withIcon)
  expect(appReducer(withIcon, { type: 'setWatchlistIcon', id, icon: '🚀 rápido' }).watchlists[0].icon).toBe('🚀')
  const without = appReducer(withIcon, { type: 'setWatchlistIcon', id, icon: null })
  expect('icon' in without.watchlists[0]).toBe(false)
  expect(appReducer(base, { type: 'setWatchlistIcon', id: 'nada', icon: '🏦' })).toBe(base)
})

test('Should copy the icon when duplicating a watchlist', () => {
  const id = base.watchlists[0].id
  const withIcon = appReducer(base, { type: 'setWatchlistIcon', id, icon: '🏦' })
  const copied = appReducer(withIcon, { type: 'duplicateWatchlist', id, newId: 'copia' })
  expect(copied.watchlists.find((list) => list.id === 'copia')?.icon).toBe('🏦')
})

test('Should remember the look of each kind of drawing apart', () => {
  const look = { color: '#FFFFFF', width: 1, lineStyle: 'dashed' as const, opacity: 0.5, hidePrice: true as const }
  const remembered = appReducer(base, { type: 'rememberLook', kind: 'hline', look })
  expect(remembered.lineLooks).toEqual({ hline: look })
  const both = appReducer(remembered, { type: 'rememberLook', kind: 'trend', look: { color: '#F23645', width: 3 } })
  expect(both.lineLooks).toEqual({ hline: look, trend: { color: '#F23645', width: 3 } })
})

test('Should keep the same state when the look to remember is the one already remembered', () => {
  const look = { color: '#FFFFFF', width: 1 }
  const remembered = appReducer(base, { type: 'rememberLook', kind: 'hline', look })
  expect(appReducer(remembered, { type: 'rememberLook', kind: 'hline', look: { ...look } })).toBe(remembered)
})

test('Should switch the earnings warning of the watchlist on and off', () => {
  const on = appReducer(base, { type: 'setEarningsBadge', on: true })
  expect(on.earningsBadge).toBe(true)
  expect(appReducer(on, { type: 'setEarningsBadge', on: true })).toBe(on)
  expect(appReducer(on, { type: 'setEarningsBadge', on: false }).earningsBadge).toBe(false)
})

test('Should hide and show the market ticker', () => {
  const hidden = appReducer(base, { type: 'setTickerVisible', on: false })
  expect(hidden.ticker.visible).toBe(false)
  expect(hidden.ticker.items).toBe(base.ticker.items)
  expect(appReducer(hidden, { type: 'setTickerVisible', on: false })).toBe(hidden)
  expect(appReducer(hidden, { type: 'setTickerVisible', on: true }).ticker.visible).toBe(true)
})

test('Should add a symbol to the market ticker once and remove it again', () => {
  const added = appReducer(base, { type: 'addToTicker', symbol: 'AAPL' })
  expect(added.ticker.items.at(-1)).toEqual({ symbol: 'AAPL', name: 'AAPL' })
  expect(appReducer(added, { type: 'addToTicker', symbol: 'AAPL' })).toBe(added)
  const removed = appReducer(added, { type: 'removeFromTicker', symbol: 'AAPL' })
  expect(removed.ticker.items).toEqual(base.ticker.items)
  expect(appReducer(removed, { type: 'removeFromTicker', symbol: 'AAPL' })).toBe(removed)
})

test('Should add a column to the watchlist and widen the list to make room for it', () => {
  const one = appReducer({ ...base, listWidth: 400 }, { type: 'setWatchlistColumns', columns: ['rsi'] })
  expect(one.watchlistColumns).toEqual(['rsi'])
  expect(one.listWidth).toBe(464)
  const two = appReducer(one, { type: 'setWatchlistColumns', columns: ['earnings', 'rsi'] })
  expect(two.watchlistColumns).toEqual(['rsi', 'earnings'])
  expect(two.listWidth).toBe(528)
  expect(appReducer(two, { type: 'setWatchlistColumns', columns: ['rsi'] }).listWidth).toBe(464)
})

test('Should not widen the list past its limit nor keep sorting by a column it hides', () => {
  const wide = appReducer({ ...base, listWidth: 640 }, { type: 'setWatchlistColumns', columns: ['rsi', 'level'] })
  expect(wide.listWidth).toBe(768)
  const sorted = appReducer(wide, { type: 'setWatchlistSort', sort: { column: 'level', direction: 'asc' } })
  const hidden = appReducer(sorted, { type: 'setWatchlistColumns', columns: ['rsi'] })
  expect(hidden.watchlistSort).toBeNull()
  expect(hidden.listWidth).toBe(704)
  expect(appReducer(hidden, { type: 'setListWidth', width: 2000 }).listWidth).toBe(704)
})

test('Should flag a symbol in every list, change its colour and take the flag off', () => {
  const red = appReducer(base, { type: 'setFlag', symbol: 'KO', color: 'red' })
  expect(red.flags).toEqual({ KO: 'red' })
  expect(appReducer(red, { type: 'setFlag', symbol: 'KO', color: 'blue' }).flags).toEqual({ KO: 'blue' })
  expect(appReducer(red, { type: 'setFlag', symbol: 'KO', color: null }).flags).toEqual({})
  expect(appReducer(red, { type: 'setFlag', symbol: 'KO', color: 'red' })).toBe(red)
})

test('Should switch between every symbol and the flagged ones only', () => {
  const only = appReducer(base, { type: 'setOnlyFlagged', on: true })
  expect(only.onlyFlagged).toBe(true)
  expect(appReducer(only, { type: 'setOnlyFlagged', on: true })).toBe(only)
})

const oversold = {
  id: 'f1',
  name: 'Sobrevendidas',
  scope: 'list' as const,
  conditions: [{ field: 'rsi' as const, op: 'below' as const, value: 30 }],
}

test('Should save a new filter and apply it, then replace it when edited', () => {
  const saved = appReducer(base, { type: 'saveFilter', filter: oversold })
  expect(saved.filters).toEqual([oversold])
  expect(saved.activeFilterId).toBe('f1')
  const edited = appReducer(saved, { type: 'saveFilter', filter: { ...oversold, name: 'RSI < 25' } })
  expect(edited.filters).toEqual([{ ...oversold, name: 'RSI < 25' }])
})

test('Should apply a saved filter, clear it and delete it', () => {
  const saved = appReducer(appReducer(base, { type: 'saveFilter', filter: oversold }), { type: 'applyFilter', id: null })
  expect(saved.activeFilterId).toBeNull()
  expect(appReducer(saved, { type: 'applyFilter', id: 'nope' })).toBe(saved)
  const applied = appReducer(saved, { type: 'applyFilter', id: 'f1' })
  expect(applied.activeFilterId).toBe('f1')
  const deleted = appReducer(applied, { type: 'deleteFilter', id: 'f1' })
  expect(deleted.filters).toEqual([])
  expect(deleted.activeFilterId).toBeNull()
})

test('Should save the symbols a filter shows as a new list and open it', () => {
  const items = [
    { symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' },
    { symbol: 'PEP', name: 'PepsiCo', exchange: 'NASDAQ' },
  ]
  const out = appReducer(base, { type: 'createWatchlistWith', id: 'new', name: ' Sobrevendidas ', items })
  expect(out.watchlists.at(-1)).toEqual({ id: 'new', name: 'Sobrevendidas', items })
  expect(out.activeWatchlistId).toBe('new')
})

test('Should fold and unfold the watchlist', () => {
  const folded = appReducer(base, { type: 'setListHidden', on: true })
  expect(folded.listHidden).toBe(true)
  expect(appReducer(folded, { type: 'setListHidden', on: true })).toBe(folded)
  expect(appReducer(folded, { type: 'setListHidden', on: false }).listHidden).toBe(false)
})

test('Should clear the history of alerts', () => {
  const event = { id: 'e', symbol: 'KO', level: 60, price: 60.2, direction: 'up' as const, at: '2026-11-25T15:00:00.000Z', text: null }
  const withEvents = { ...base, alertHistory: [event] }
  expect(appReducer(withEvents, { type: 'clearAlertHistory' }).alertHistory).toEqual([])
  expect(appReducer(base, { type: 'clearAlertHistory' })).toBe(base)
})

test('Should keep the sections of an imported list', () => {
  const items = [{ kind: 'section' as const, id: 's1', title: 'Tech' }, { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }]
  const out = appReducer(base, { type: 'createWatchlistWith', id: 'imported', name: 'Tech', items })
  expect(out.watchlists.at(-1)?.items).toEqual(items)
})

test('Should set, change and remove the position of a symbol', () => {
  const held = appReducer(base, { type: 'setHolding', symbol: 'KO', holding: { quantity: 100, price: 58.2 } })
  expect(held.holdings).toEqual({ KO: { quantity: 100, price: 58.2 } })
  expect(appReducer(held, { type: 'setHolding', symbol: 'KO', holding: { quantity: 0, price: 58.2 } })).toBe(held)
  expect(appReducer(held, { type: 'setHolding', symbol: 'KO', holding: null }).holdings).toEqual({})
})

test('Should share the positions with the AI only when switched on', () => {
  const shared = appReducer(base, { type: 'setShareHoldings', on: true })
  expect(shared.shareHoldings).toBe(true)
  expect(appReducer(shared, { type: 'setShareHoldings', on: true })).toBe(shared)
})

test('Should add an indicator alert to a symbol, arm or disarm it and remove it', () => {
  const alert = { id: 'r', kind: 'rsi' as const, value: 30, armed: true }
  const added = appReducer(base, { type: 'addIndicatorAlert', symbol: 'KO', alert })
  expect(added.indicatorAlerts).toEqual({ KO: [alert] })
  const quiet = appReducer(added, { type: 'armIndicatorAlert', symbol: 'KO', id: 'r', armed: false })
  expect(quiet.indicatorAlerts.KO[0].armed).toBe(false)
  expect(appReducer(quiet, { type: 'removeIndicatorAlert', symbol: 'KO', id: 'r' }).indicatorAlerts).toEqual({})
})

test('Should hide every drawing and lock them, and undo both', () => {
  const hidden = appReducer(base, { type: 'setDrawingsHidden', on: true })
  expect(hidden.drawingsHidden).toBe(true)
  const locked = appReducer(hidden, { type: 'setDrawingsLocked', on: true })
  expect(locked.drawingsLocked).toBe(true)
  expect(appReducer(locked, { type: 'setDrawingsLocked', on: true })).toBe(locked)
  expect(appReducer(locked, { type: 'setDrawingsHidden', on: false }).drawingsHidden).toBe(false)
})
