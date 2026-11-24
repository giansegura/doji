import { NOTE_MAX_LENGTH } from '../shared/limits'
import type { AppState, Drawing, HorizontalLine } from '../shared/types'
import { appReducer } from '../src/state/appReducer'

export type Edit<T> = { ok: true; state: AppState; detail: T } | { ok: false; error: string }

type LevelRequest = { symbol: string; price: number; alert: boolean; color: string; id: string; pricedAt: string }

type AlertRequest = { symbol: string; drawingId: string; on: boolean }

type NoteRequest = { symbol: string; text: string; mode: 'append' | 'replace' }

const LINE_WIDTH = 2
const NOT_ALERTABLE = 'Alerts work only on trend lines and horizontal lines drawn on the price.'

export const keyOf = (symbol: string): string => symbol.trim().toUpperCase()

const drawingsOf = (state: AppState, symbol: string): Drawing[] => state.lines[symbol] ?? []

const withDrawings = (state: AppState, symbol: string, lines: Drawing[]): AppState =>
  appReducer(state, { type: 'setLines', symbol, lines })

export const addLevel = (state: AppState, request: LevelRequest): Edit<HorizontalLine> => {
  const symbol = keyOf(request.symbol)
  if (!Number.isFinite(request.price) || request.price <= 0) return { ok: false, error: 'The price must be a positive number.' }
  const line: HorizontalLine = {
    kind: 'hline',
    id: request.id,
    pane: 'price',
    timeframe: 'D',
    value: request.price,
    color: request.color,
    width: LINE_WIDTH,
    pricedAt: request.pricedAt,
    ...(request.alert ? { alert: true } : {}),
  }
  return { ok: true, state: withDrawings(state, symbol, [...drawingsOf(state, symbol), line]), detail: line }
}

const switched = (drawing: Drawing, on: boolean): Drawing => {
  if (drawing.kind === 'channel' || drawing.kind === 'rect') return drawing
  const { alert: _alert, ...quiet } = drawing
  return on ? { ...quiet, alert: true } : quiet
}

export const setAlert = (state: AppState, request: AlertRequest): Edit<Drawing> => {
  const symbol = keyOf(request.symbol)
  const drawings = drawingsOf(state, symbol)
  const target = drawings.find((drawing) => drawing.id === request.drawingId)
  if (!target) return { ok: false, error: `${symbol} has no drawing with id "${request.drawingId}".` }
  if (target.pane !== 'price' || target.kind === 'channel' || target.kind === 'rect') return { ok: false, error: NOT_ALERTABLE }
  const updated = switched(target, request.on)
  const lines = drawings.map((drawing) => (drawing === target ? updated : drawing))
  return { ok: true, state: withDrawings(state, symbol, lines), detail: updated }
}

export const writeNote = (state: AppState, request: NoteRequest): Edit<{ length: number; truncated: boolean }> => {
  const symbol = keyOf(request.symbol)
  const current = state.notes[symbol] ?? ''
  const text = request.mode === 'append' && current ? `${current}\n\n${request.text}` : request.text
  const next = appReducer(state, { type: 'setNote', symbol, text })
  const length = next.notes[symbol]?.length ?? 0
  return { ok: true, state: next, detail: { length, truncated: text.length > NOTE_MAX_LENGTH } }
}
