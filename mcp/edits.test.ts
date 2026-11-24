import { expect, test } from 'vitest'
import { NOTE_MAX_LENGTH } from '../shared/limits'
import { type AppState, DEFAULT_STATE, type Drawing } from '../shared/types'
import { addLevel, setAlert, writeNote } from './edits'

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
