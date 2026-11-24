import { expect, test } from 'vitest'
import { applyChanges, changesSince } from './stateChanges'
import { type AppState, DEFAULT_STATE, type TrendLine } from './types'

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

const saved: AppState = { ...DEFAULT_STATE, rev: 7, lines: { AAPL: [line('a')], KO: [line('k')] } }

test('Should list nothing when nothing changed', () => {
  expect(changesSince(saved, { ...saved })).toEqual({})
})

test('Should list only the parts that changed', () => {
  const current: AppState = { ...saved, theme: 'light', symbol: 'KO' }
  expect(changesSince(saved, current)).toEqual({ theme: 'light', symbol: 'KO' })
})

test('Should not list the revision', () => {
  expect(changesSince(saved, { ...saved, rev: 9 })).toEqual({})
})

test('Should list only the symbols whose lines changed', () => {
  const current: AppState = { ...saved, lines: { ...saved.lines, AAPL: [line('a'), line('b')] } }
  expect(changesSince(saved, current)).toEqual({ lines: { AAPL: [line('a'), line('b')] } })
})

test('Should list a symbol that lost its lines as empty', () => {
  const current: AppState = { ...saved, lines: { AAPL: saved.lines.AAPL } }
  expect(changesSince(saved, current)).toEqual({ lines: { KO: [] } })
})

test('Should list the lines of a symbol that had none', () => {
  const current: AppState = { ...saved, lines: { ...saved.lines, MSFT: [line('m')] } }
  expect(changesSince(saved, current)).toEqual({ lines: { MSFT: [line('m')] } })
})

test('Should apply the parts that changed and keep the rest', () => {
  const applied = applyChanges(saved, { theme: 'light', lines: { AAPL: [line('z')] } })
  expect(applied.theme).toBe('light')
  expect(applied.watchlists).toBe(saved.watchlists)
  expect(applied.lines).toEqual({ AAPL: [line('z')], KO: [line('k')] })
})

test('Should drop a symbol whose lines come back empty', () => {
  expect(applyChanges(saved, { lines: { KO: [] } }).lines).toEqual({ AAPL: [line('a')] })
})

test('Should rebuild the current state from the saved one and its changes', () => {
  const current: AppState = {
    ...saved,
    timeframe: 'W',
    activeWatchlistId: 'otra',
    watchlists: [...saved.watchlists, { id: 'otra', name: 'Otra', items: [] }],
    indicators: { ...saved.indicators, volume: { visible: false } },
    chart: { ...saved.chart, invert: true },
    lines: { AAPL: [line('a'), line('b')], MSFT: [line('m')] },
  }
  expect(applyChanges(saved, changesSince(saved, current))).toEqual(current)
})

test('Should list a new list width as a change', () => {
  const saved: AppState = { ...DEFAULT_STATE, listWidth: 320 }
  const current: AppState = { ...saved, listWidth: 410 }
  expect(changesSince(saved, current)).toEqual({ listWidth: 410 })
  expect(applyChanges(saved, { listWidth: 410 }).listWidth).toBe(410)
})

test('Should list the notes as a change when one is written', () => {
  const saved: AppState = { ...DEFAULT_STATE, notes: {} }
  const current: AppState = { ...saved, notes: { KO: 'tesis' } }
  expect(changesSince(saved, current)).toEqual({ notes: { KO: 'tesis' } })
})

test('Should list the second chart as a change when it is opened or closed', () => {
  const saved: AppState = { ...DEFAULT_STATE, secondChart: null }
  expect(changesSince(saved, { ...saved, secondChart: 'W' })).toEqual({ secondChart: 'W' })
  expect(changesSince({ ...saved, secondChart: 'W' }, saved)).toEqual({ secondChart: null })
})
