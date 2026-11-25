import { expect, test } from 'vitest'
import { LIST_NAME_MAX_LENGTH, MAX_LISTS, NOTE_MAX_LENGTH } from '../shared/limits'
import { type AppState, DEFAULT_STATE, type Drawing, type SymbolInfo } from '../shared/types'
import {
  addLevel,
  addSectionTo,
  addSymbols,
  addTrend,
  createList,
  deleteDrawing,
  removeSymbols,
  renameList,
  setAlert,
  setListIcon,
  updateDrawing,
  writeNote,
} from './edits'

const base = { pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 2, pricedAt: '2020-01-01' }

const trend: Drawing = { ...base, id: 't', p1: { date: '2026-11-02', value: 100 }, p2: { date: '2026-11-16', value: 120 }, extendRight: false }
const level: Drawing = { ...base, id: 'h', kind: 'hline', value: 90 }
const box: Drawing = { ...base, id: 'r', kind: 'rect', p1: { date: '2026-11-02', value: 100 }, p2: { date: '2026-11-16', value: 120 } }
const rsiLine: Drawing = { ...base, id: 'x', pane: 'rsi', p1: { date: '2026-11-02', value: 30 }, p2: { date: '2026-11-16', value: 40 }, extendRight: false }

const state: AppState = { ...DEFAULT_STATE, lines: { KO: [trend, level, box, rsiLine] }, notes: { KO: 'Tesis inicial' } }

test('Should add a horizontal line on the price at the end of the drawings of the symbol', () => {
  const result = addLevel(state, { symbol: 'ko', price: 95.5, alert: false, color: '#FF9800', id: 'new', pricedAt: '2024-06-10' })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.state.lines.KO.at(-1)).toEqual({
    kind: 'hline',
    id: 'new',
    pane: 'price',
    timeframe: 'D',
    value: 95.5,
    color: '#FF9800',
    width: 2,
    pricedAt: '2024-06-10',
    by: 'ai',
  })
  expect(result.state.lines.KO).toHaveLength(5)
})

test('Should arm the alert of a new horizontal line when asked', () => {
  const result = addLevel(state, { symbol: 'PEP', price: 140, alert: true, color: '#2962FF', id: 'new', pricedAt: '0000-01-01' })
  expect(result.ok && result.state.lines.PEP).toEqual([expect.objectContaining({ id: 'new', value: 140, alert: true })])
})

test('Should refuse a price that is not positive', () => {
  expect(addLevel(state, { symbol: 'KO', price: 0, alert: false, color: '#2962FF', id: 'new', pricedAt: '0000-01-01' })).toEqual({
    ok: false,
    error: 'The price must be a positive number.',
  })
})

test('Should arm and disarm the alert of a trend line or a horizontal line', () => {
  const armed = setAlert(state, { symbol: 'KO', drawingId: 't', on: true })
  expect(armed.ok && armed.state.lines.KO[0]).toEqual({ ...trend, alert: true })
  if (!armed.ok) return
  const disarmed = setAlert(armed.state, { symbol: 'KO', drawingId: 't', on: false })
  expect(disarmed.ok && disarmed.state.lines.KO[0]).toEqual(trend)
  const levelArmed = setAlert(state, { symbol: 'KO', drawingId: 'h', on: true })
  expect(levelArmed.ok && levelArmed.state.lines.KO[1]).toEqual({ ...level, alert: true })
})

test('Should refuse an alert on a drawing that does not exist or cannot carry one', () => {
  expect(setAlert(state, { symbol: 'KO', drawingId: 'zz', on: true })).toEqual({ ok: false, error: 'KO has no drawing with id "zz".' })
  const refused = { ok: false, error: 'Alerts work only on trend lines and horizontal lines drawn on the price.' }
  expect(setAlert(state, { symbol: 'KO', drawingId: 'r', on: true })).toEqual(refused)
  expect(setAlert(state, { symbol: 'KO', drawingId: 'x', on: true })).toEqual(refused)
})

test('Should add to the note of a symbol after a blank line, or start one', () => {
  const added = writeNote(state, { symbol: 'KO', text: 'Stop en 52', mode: 'append' })
  expect(added.ok && added.state.notes.KO).toBe('Tesis inicial\n\nStop en 52')
  const started = writeNote(state, { symbol: 'PEP', text: 'Vigilar', mode: 'append' })
  expect(started.ok && started.state.notes.PEP).toBe('Vigilar')
})

test('Should replace the note of a symbol when asked', () => {
  const replaced = writeNote(state, { symbol: 'KO', text: 'Nueva tesis', mode: 'replace' })
  expect(replaced.ok && replaced.state.notes.KO).toBe('Nueva tesis')
})

test('Should say when a note was cut to its maximum length', () => {
  const result = writeNote(state, { symbol: 'KO', text: 'x'.repeat(NOTE_MAX_LENGTH + 10), mode: 'replace' })
  expect(result.ok && result.detail).toEqual({ length: NOTE_MAX_LENGTH, truncated: true })
  expect(result.ok && result.state.notes.KO).toHaveLength(NOTE_MAX_LENGTH)
})

const info = (symbol: string): SymbolInfo => ({ symbol, name: `${symbol} Inc.`, exchange: 'NYSE' })

const listsState: AppState = {
  ...DEFAULT_STATE,
  watchlists: [
    {
      id: 'main',
      name: 'Principal',
      items: [info('KO'), { kind: 'section', id: 's1', title: 'Vigilando' }, info('PEP'), { kind: 'section', id: 's2', title: 'Tech' }, info('NVDA')],
    },
    { id: 'tech', name: 'Tech', items: [] },
  ],
  activeWatchlistId: 'main',
}

const itemsOf = (state: AppState, id: string) =>
  state.watchlists.find((list) => list.id === id)?.items.map((item) => ('kind' in item ? `[${item.title}]` : item.symbol))

test('Should create a watchlist with its symbols without changing the one on screen', () => {
  const result = createList(listsState, { id: 'div', name: '  Dividendos  ', symbols: [info('KO'), info('PG'), info('KO')] })
  expect(result.ok && result.detail).toEqual({ id: 'div', name: 'Dividendos', added: ['KO', 'PG'], icon: null })
  if (!result.ok) return
  expect(itemsOf(result.state, 'div')).toEqual(['KO', 'PG'])
  expect(result.state.activeWatchlistId).toBe('main')
})

test('Should refuse a watchlist without a name, with a name already taken or beyond the limit', () => {
  expect(createList(listsState, { id: 'x', name: '  ', symbols: [] })).toEqual({ ok: false, error: 'The watchlist needs a name.' })
  expect(createList(listsState, { id: 'x', name: 'tech', symbols: [] })).toEqual({ ok: false, error: 'There is already a watchlist called "Tech".' })
  const full: AppState = { ...listsState, watchlists: Array.from({ length: MAX_LISTS }, (_, index) => ({ id: `l${index}`, name: `L${index}`, items: [] })) }
  expect(createList(full, { id: 'x', name: 'Otra', symbols: [] })).toEqual({ ok: false, error: `doji keeps at most ${MAX_LISTS} watchlists.` })
})

test('Should cut a watchlist name to the longest doji keeps', () => {
  const result = createList(listsState, { id: 'x', name: 'x'.repeat(LIST_NAME_MAX_LENGTH + 5), symbols: [] })
  expect(result.ok && result.detail.name).toHaveLength(LIST_NAME_MAX_LENGTH)
})

test('Should add symbols at the end of a watchlist and skip the ones already in it', () => {
  const result = addSymbols(listsState, { listId: 'main', symbols: [info('AAPL'), info('pep')], section: null })
  expect(result.ok && result.detail).toEqual({ added: ['AAPL'], already: ['PEP'] })
  expect(result.ok && itemsOf(result.state, 'main')).toEqual(['KO', '[Vigilando]', 'PEP', '[Tech]', 'NVDA', 'AAPL'])
})

test('Should add symbols at the end of the section asked for, in any case', () => {
  const result = addSymbols(listsState, { listId: 'main', symbols: [info('MSFT'), info('V')], section: 'vigilando' })
  expect(result.ok && itemsOf(result.state, 'main')).toEqual(['KO', '[Vigilando]', 'PEP', 'MSFT', 'V', '[Tech]', 'NVDA'])
})

test('Should refuse a section the watchlist does not have', () => {
  expect(addSymbols(listsState, { listId: 'main', symbols: [info('MSFT')], section: 'Bancos' })).toEqual({
    ok: false,
    error: 'Principal has no section called "Bancos". Its sections are: Vigilando, Tech.',
  })
  expect(addSymbols(listsState, { listId: 'tech', symbols: [info('MSFT')], section: 'Bancos' })).toEqual({
    ok: false,
    error: 'Tech has no section called "Bancos". It has no sections.',
  })
})

test('Should change nothing when every symbol is already in the watchlist', () => {
  const result = addSymbols(listsState, { listId: 'main', symbols: [info('KO')], section: null })
  expect(result.ok && result.state).toBe(listsState)
})

test('Should add a section at the end of a watchlist and refuse one it already has', () => {
  const result = addSectionTo(listsState, { listId: 'tech', id: 's9', title: ' Semis ' })
  expect(result.ok && result.detail).toEqual({ id: 's9', title: 'Semis' })
  expect(result.ok && itemsOf(result.state, 'tech')).toEqual(['[Semis]'])
  expect(addSectionTo(listsState, { listId: 'main', id: 's9', title: 'TECH' })).toEqual({
    ok: false,
    error: 'Principal already has a section called "Tech".',
  })
  expect(addSectionTo(listsState, { listId: 'main', id: 's9', title: ' ' })).toEqual({ ok: false, error: 'The section needs a title.' })
})

test('Should remove symbols from a watchlist and say which ones were not in it', () => {
  const result = removeSymbols(listsState, { listId: 'main', symbols: ['pep', 'AAPL'] })
  expect(result.ok && result.detail).toEqual({ removed: ['PEP'], missing: ['AAPL'] })
  expect(result.ok && itemsOf(result.state, 'main')).toEqual(['KO', '[Vigilando]', '[Tech]', 'NVDA'])
  const none = removeSymbols(listsState, { listId: 'main', symbols: ['AAPL'] })
  expect(none.ok && none.state).toBe(listsState)
})

test('Should rename a watchlist and refuse a name another one has', () => {
  const result = renameList(listsState, { listId: 'tech', name: ' Semis ' })
  expect(result.ok && result.detail).toEqual({ id: 'tech', name: 'Semis' })
  expect(result.ok && result.state.watchlists[1].name).toBe('Semis')
  expect(renameList(listsState, { listId: 'tech', name: 'principal' })).toEqual({
    ok: false,
    error: 'There is already a watchlist called "Principal".',
  })
  const same = renameList(listsState, { listId: 'tech', name: 'Tech' })
  expect(same.ok && same.state).toBe(listsState)
})

test('Should create a watchlist with an icon', () => {
  const result = createList(listsState, { id: 'div', name: 'Dividendos', symbols: [], icon: '💰' })
  expect(result.ok && result.state.watchlists.at(-1)).toEqual({ id: 'div', name: 'Dividendos', items: [], icon: '💰' })
  expect(result.ok && result.detail).toMatchObject({ icon: '💰' })
})

test('Should put an icon on a watchlist, change it and take it away', () => {
  const result = setListIcon(listsState, { listId: 'tech', icon: '💻 y más' })
  expect(result.ok && result.detail).toEqual({ id: 'tech', icon: '💻' })
  if (!result.ok) return
  const cleared = setListIcon(result.state, { listId: 'tech', icon: '' })
  expect(cleared.ok && cleared.detail).toEqual({ id: 'tech', icon: null })
  expect(cleared.ok && 'icon' in cleared.state.watchlists[1]).toBe(false)
})

const trendRequest = {
  symbol: 'ko',
  from: { date: '2026-10-01', price: 58 },
  to: { date: '2026-11-02', price: 61.5 },
  extendRight: true,
  alert: false,
  color: '#FF9800',
  text: 'Soporte',
  id: 'ai-t',
  pricedAt: '2024-06-10',
}

test('Should draw a trend line on the price between two points, marked as drawn by the AI', () => {
  const result = addTrend(state, trendRequest)
  expect(result.ok && result.state.lines.KO.at(-1)).toEqual({
    kind: 'trend',
    id: 'ai-t',
    pane: 'price',
    timeframe: 'D',
    p1: { date: '2026-10-01', value: 58 },
    p2: { date: '2026-11-02', value: 61.5 },
    extendRight: true,
    color: '#FF9800',
    width: 2,
    pricedAt: '2024-06-10',
    text: 'Soporte',
    by: 'ai',
  })
})

test('Should refuse a trend line with dates out of order or a price that is not positive', () => {
  expect(addTrend(state, { ...trendRequest, to: { date: '2026-09-01', price: 61 } })).toEqual({ ok: false, error: 'The second point must come after the first.' })
  expect(addTrend(state, { ...trendRequest, from: { date: '2026-10-01', price: 0 } })).toEqual({ ok: false, error: 'The prices must be positive numbers.' })
  expect(addTrend(state, { ...trendRequest, from: { date: '1 Oct', price: 58 } })).toEqual({ ok: false, error: 'Dates must be written as YYYY-MM-DD.' })
})

test('Should move a horizontal line, restyle it and write its text', () => {
  const result = updateDrawing(state, { symbol: 'KO', drawingId: 'h', price: 92, color: '#FFFFFF', lineStyle: 'dashed', opacity: 0.5, width: 1, text: 'R1' })
  expect(result.ok && result.state.lines.KO[1]).toEqual({ ...level, value: 92, color: '#FFFFFF', lineStyle: 'dashed', opacity: 0.5, width: 1, text: 'R1' })
})

test('Should move the points of a trend line, extend it and clear its look and text', () => {
  const styled = { ...state, lines: { KO: [{ ...trend, lineStyle: 'dotted' as const, opacity: 0.4, text: 'x' }] } }
  const result = updateDrawing(styled, {
    symbol: 'KO',
    drawingId: 't',
    from: { date: '2026-11-03', price: 101 },
    to: { date: '2026-11-20', price: 125 },
    extendRight: true,
    lineStyle: 'solid',
    opacity: 1,
    text: '',
  })
  expect(result.ok && result.state.lines.KO[0]).toEqual({
    ...trend,
    p1: { date: '2026-11-03', value: 101 },
    p2: { date: '2026-11-20', value: 125 },
    extendRight: true,
  })
})

test('Should refuse to change what a drawing does not have, or a drawing that does not exist', () => {
  expect(updateDrawing(state, { symbol: 'KO', drawingId: 't', price: 3 })).toEqual({ ok: false, error: 'Only horizontal lines have a single price; move a trend line with from and to.' })
  expect(updateDrawing(state, { symbol: 'KO', drawingId: 'h', extendRight: true })).toEqual({ ok: false, error: 'Only trend lines can be extended.' })
  expect(updateDrawing(state, { symbol: 'KO', drawingId: 'zz', color: '#FFFFFF' })).toEqual({ ok: false, error: 'KO has no drawing with id "zz".' })
})

test('Should delete only the drawings the AI made', () => {
  const made = { ...trend, id: 'mine', by: 'ai' as const }
  const withMine = { ...state, lines: { KO: [...state.lines.KO, made] } }
  const result = deleteDrawing(withMine, { symbol: 'ko', drawingId: 'mine' })
  expect(result.ok && result.state.lines.KO.map((drawing) => drawing.id)).toEqual(['t', 'h', 'r', 'x'])
  expect(deleteDrawing(withMine, { symbol: 'KO', drawingId: 't' })).toEqual({
    ok: false,
    error: 'The AI can delete only the drawings it made. Ask the user to delete this one in doji.',
  })
})
