import { LINE_TEXT_MAX_LENGTH, LIST_NAME_MAX_LENGTH, MAX_LISTS, MIN_LINE_OPACITY, NOTE_MAX_LENGTH, SMA_MAX_WIDTH, SMA_MIN_WIDTH } from '../shared/limits'
import { toListIcon } from '../shared/listIcon'
import { isSection } from '../shared/listItems'
import type { AppState, Drawing, HorizontalLine, LinePoint, LineStyle, ListItem, Split, SymbolInfo, SymbolList, TrendLine } from '../shared/types'
import { adjustLinesForSplits } from '../src/domain/splits'
import { appReducer } from '../src/state/appReducer'

export type Edit<T> = { ok: true; state: AppState; detail: T } | { ok: false; error: string }

type LevelRequest = { symbol: string; price: number; alert: boolean; color: string; id: string; pricedAt: string }

type AlertRequest = { symbol: string; drawingId: string; on: boolean }

type Point = { date: string; price: number }

type TrendRequest = {
  symbol: string
  from: Point
  to: Point
  extendRight: boolean
  alert: boolean
  color: string
  text: string | null
  id: string
  pricedAt: string
}

type UpdateRequest = {
  symbol: string
  drawingId: string
  price?: number
  from?: Point
  to?: Point
  extendRight?: boolean
  color?: string
  width?: number
  lineStyle?: LineStyle
  opacity?: number
  text?: string
  splits?: Split[]
}

type DeleteRequest = { symbol: string; drawingId: string }

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
    by: 'ai',
  }
  return { ok: true, state: withDrawings(state, symbol, [...drawingsOf(state, symbol), line]), detail: line }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

const pointError = (from: Point, to: Point, ordered = true): string | null => {
  if (!DATE.test(from.date) || !DATE.test(to.date)) return 'Dates must be written as YYYY-MM-DD.'
  if (!(from.price > 0) || !(to.price > 0) || !Number.isFinite(from.price) || !Number.isFinite(to.price)) return 'The prices must be positive numbers.'
  return !ordered || from.date < to.date ? null : 'The second point must come after the first.'
}

const linePoint = (point: Point): LinePoint => ({ date: point.date, value: point.price })

const cleanText = (text: string): string => text.trim().slice(0, LINE_TEXT_MAX_LENGTH)

export const addTrend = (state: AppState, request: TrendRequest): Edit<TrendLine> => {
  const symbol = keyOf(request.symbol)
  const error = pointError(request.from, request.to)
  if (error) return { ok: false, error }
  const text = request.text ? cleanText(request.text) : ''
  const line: TrendLine = {
    kind: 'trend',
    id: request.id,
    pane: 'price',
    timeframe: 'D',
    p1: linePoint(request.from),
    p2: linePoint(request.to),
    extendRight: request.extendRight,
    color: request.color,
    width: LINE_WIDTH,
    pricedAt: request.pricedAt,
    ...(request.alert ? { alert: true } : {}),
    ...(text ? { text } : {}),
    by: 'ai',
  }
  return { ok: true, state: withDrawings(state, symbol, [...drawingsOf(state, symbol), line]), detail: line }
}

const restyled = (drawing: Drawing, request: UpdateRequest): Drawing => {
  const { lineStyle: _style, opacity: _opacity, ...plain } = drawing
  const lineStyle = request.lineStyle ?? drawing.lineStyle ?? 'solid'
  const opacity = request.opacity ?? drawing.opacity ?? 1
  return {
    ...plain,
    ...(request.color ? { color: request.color } : {}),
    ...(request.width !== undefined ? { width: Math.round(Math.min(Math.max(request.width, SMA_MIN_WIDTH), SMA_MAX_WIDTH)) } : {}),
    ...(lineStyle === 'solid' ? {} : { lineStyle }),
    ...(opacity >= 1 ? {} : { opacity: Math.max(opacity, MIN_LINE_OPACITY) }),
  } as Drawing
}

const retexted = (drawing: Drawing, text: string | undefined): Drawing => {
  if (text === undefined || (drawing.kind !== 'hline' && drawing.kind !== undefined && drawing.kind !== 'trend')) return drawing
  const { text: _old, ...rest } = drawing as TrendLine | HorizontalLine
  const clean = cleanText(text)
  return (clean ? { ...rest, text: clean } : rest) as Drawing
}

const changeError = (drawing: Drawing, request: UpdateRequest): string | null => {
  const isTrend = drawing.kind === undefined || drawing.kind === 'trend'
  if (request.price !== undefined && drawing.kind !== 'hline') return 'Only horizontal lines have a single price; move a trend line with from and to.'
  if (request.price !== undefined && !(request.price > 0)) return 'The price must be a positive number.'
  if (request.extendRight !== undefined && !isTrend) return 'Only trend lines can be extended.'
  if ((request.from || request.to) && (drawing.kind === 'hline' || drawing.kind === 'position')) return 'Move this drawing with price, or change it in doji.'
  if (request.text !== undefined && !isTrend && drawing.kind !== 'hline') return 'Only trend lines and horizontal lines carry a text.'
  return null
}

const moved = (drawing: Drawing, request: UpdateRequest): Drawing | string => {
  if (drawing.kind === 'hline') return request.price === undefined ? drawing : { ...drawing, value: request.price }
  if (drawing.kind === 'position' || (!request.from && !request.to)) return drawing
  const from = request.from ?? { date: drawing.p1.date, price: drawing.p1.value }
  const to = request.to ?? { date: drawing.p2.date, price: drawing.p2.value }
  const error = pointError(from, to, drawing.kind !== 'rect')
  return error ?? { ...drawing, p1: linePoint(from), p2: linePoint(to) }
}

export const updateDrawing = (state: AppState, request: UpdateRequest): Edit<Drawing> => {
  const symbol = keyOf(request.symbol)
  const drawings = drawingsOf(state, symbol)
  const stored = drawings.find((drawing) => drawing.id === request.drawingId)
  if (!stored) return { ok: false, error: `${symbol} has no drawing with id "${request.drawingId}".` }
  const [target] = adjustLinesForSplits([stored], request.splits ?? []).lines
  const error = changeError(target, request)
  if (error) return { ok: false, error }
  const placed = moved(target, request)
  if (typeof placed === 'string') return { ok: false, error: placed }
  const extended = request.extendRight !== undefined && 'extendRight' in placed ? { ...placed, extendRight: request.extendRight } : placed
  const updated = retexted(restyled(extended, request), request.text)
  const lines = drawings.map((drawing) => (drawing === stored ? updated : drawing))
  return { ok: true, state: withDrawings(state, symbol, lines), detail: updated }
}

export const deleteDrawing = (state: AppState, request: DeleteRequest): Edit<{ id: string }> => {
  const symbol = keyOf(request.symbol)
  const drawings = drawingsOf(state, symbol)
  const target = drawings.find((drawing) => drawing.id === request.drawingId)
  if (!target) return { ok: false, error: `${symbol} has no drawing with id "${request.drawingId}".` }
  if (target.by !== 'ai') return { ok: false, error: 'The AI can delete only the drawings it made. Ask the user to delete this one in doji.' }
  return { ok: true, state: withDrawings(state, symbol, drawings.filter((drawing) => drawing !== target)), detail: { id: target.id } }
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

type CreateRequest = { id: string; name: string; symbols: SymbolInfo[]; icon?: string }

type IconRequest = { listId: string; icon: string }

type AddRequest = { listId: string; symbols: SymbolInfo[]; section: string | null }

type SectionRequest = { listId: string; id: string; title: string }

type RemoveRequest = { listId: string; symbols: string[] }

type RenameRequest = { listId: string; name: string }

const cleanName = (raw: string): string => raw.trim().slice(0, LIST_NAME_MAX_LENGTH)

const sameText = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

const listOf = (state: AppState, id: string): SymbolList => state.watchlists.find((list) => list.id === id) as SymbolList

const withItems = (state: AppState, id: string, items: ListItem[]): AppState => ({
  ...state,
  watchlists: state.watchlists.map((list) => (list.id === id ? { ...list, items } : list)),
})

const symbolsIn = (items: ListItem[]): string[] => items.flatMap((item) => (isSection(item) ? [] : [keyOf(item.symbol)]))

const nameTaken = (state: AppState, name: string, exceptId: string | null): SymbolList | undefined =>
  state.watchlists.find((list) => list.id !== exceptId && sameText(list.name, name))

const fresh = (symbols: SymbolInfo[], known: string[]): SymbolInfo[] =>
  symbols.filter(
    (item, index) =>
      !known.includes(keyOf(item.symbol)) && symbols.findIndex((other) => keyOf(other.symbol) === keyOf(item.symbol)) === index,
  )

export const createList = (
  state: AppState,
  request: CreateRequest,
): Edit<{ id: string; name: string; added: string[]; icon: string | null }> => {
  const name = cleanName(request.name)
  if (!name) return { ok: false, error: 'The watchlist needs a name.' }
  const taken = nameTaken(state, name, null)
  if (taken) return { ok: false, error: `There is already a watchlist called "${taken.name}".` }
  if (state.watchlists.length >= MAX_LISTS) return { ok: false, error: `doji keeps at most ${MAX_LISTS} watchlists.` }
  const items = fresh(request.symbols, [])
  const icon = toListIcon(request.icon)
  const list: SymbolList = { id: request.id, name, items, ...(icon ? { icon } : {}) }
  return {
    ok: true,
    state: { ...state, watchlists: [...state.watchlists, list] },
    detail: { id: request.id, name, added: items.map((item) => keyOf(item.symbol)), icon },
  }
}

const sectionEnd = (items: ListItem[], start: number): number => {
  const next = items.findIndex((item, index) => index > start && isSection(item))
  return next < 0 ? items.length : next
}

const describeSections = (items: ListItem[]): string => {
  const titles = items.flatMap((item) => (isSection(item) ? [item.title] : []))
  return titles.length > 0 ? `Its sections are: ${titles.join(', ')}.` : 'It has no sections.'
}

export const addSymbols = (state: AppState, request: AddRequest): Edit<{ added: string[]; already: string[] }> => {
  const list = listOf(state, request.listId)
  const known = symbolsIn(list.items)
  const start = request.section === null ? -1 : list.items.findIndex((item) => isSection(item) && sameText(item.title, request.section ?? ''))
  if (request.section !== null && start < 0) {
    return { ok: false, error: `${list.name} has no section called "${request.section}". ${describeSections(list.items)}` }
  }
  const added = fresh(request.symbols, known)
  const already = [...new Set(request.symbols.map((item) => keyOf(item.symbol)).filter((symbol) => known.includes(symbol)))]
  const detail = { added: added.map((item) => keyOf(item.symbol)), already }
  if (added.length === 0) return { ok: true, state, detail }
  const at = start < 0 ? list.items.length : sectionEnd(list.items, start)
  return { ok: true, state: withItems(state, list.id, [...list.items.slice(0, at), ...added, ...list.items.slice(at)]), detail }
}

export const addSectionTo = (state: AppState, request: SectionRequest): Edit<{ id: string; title: string }> => {
  const list = listOf(state, request.listId)
  const title = cleanName(request.title)
  if (!title) return { ok: false, error: 'The section needs a title.' }
  const existing = list.items.find((item) => isSection(item) && sameText(item.title, title))
  if (existing && isSection(existing)) return { ok: false, error: `${list.name} already has a section called "${existing.title}".` }
  return {
    ok: true,
    state: withItems(state, list.id, [...list.items, { kind: 'section', id: request.id, title }]),
    detail: { id: request.id, title },
  }
}

export const removeSymbols = (state: AppState, request: RemoveRequest): Edit<{ removed: string[]; missing: string[] }> => {
  const list = listOf(state, request.listId)
  const wanted = [...new Set(request.symbols.map(keyOf))]
  const known = symbolsIn(list.items)
  const removed = wanted.filter((symbol) => known.includes(symbol))
  const detail = { removed, missing: wanted.filter((symbol) => !known.includes(symbol)) }
  if (removed.length === 0) return { ok: true, state, detail }
  const items = list.items.filter((item) => isSection(item) || !removed.includes(keyOf(item.symbol)))
  return { ok: true, state: withItems(state, list.id, items), detail }
}

export const renameList = (state: AppState, request: RenameRequest): Edit<{ id: string; name: string }> => {
  const list = listOf(state, request.listId)
  const name = cleanName(request.name)
  if (!name) return { ok: false, error: 'The watchlist needs a name.' }
  const taken = nameTaken(state, name, list.id)
  if (taken) return { ok: false, error: `There is already a watchlist called "${taken.name}".` }
  const detail = { id: list.id, name }
  if (name === list.name) return { ok: true, state, detail }
  return { ok: true, state: { ...state, watchlists: state.watchlists.map((item) => (item.id === list.id ? { ...item, name } : item)) }, detail }
}

export const setListIcon = (state: AppState, request: IconRequest): Edit<{ id: string; icon: string | null }> => {
  const list = listOf(state, request.listId)
  const icon = toListIcon(request.icon)
  const detail = { id: list.id, icon }
  if ((list.icon ?? null) === icon) return { ok: true, state, detail }
  const { icon: _old, ...plain } = list
  const updated: SymbolList = icon ? { ...plain, icon } : plain
  return { ok: true, state: { ...state, watchlists: state.watchlists.map((item) => (item.id === list.id ? updated : item)) }, detail }
}
