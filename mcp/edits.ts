import { LIST_NAME_MAX_LENGTH, MAX_LISTS, NOTE_MAX_LENGTH } from '../shared/limits'
import { toListIcon } from '../shared/listIcon'
import { isSection } from '../shared/listItems'
import type { AppState, Drawing, HorizontalLine, ListItem, SymbolInfo, SymbolList } from '../shared/types'
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
