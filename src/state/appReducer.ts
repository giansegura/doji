import { LIST_NAME_MAX_LENGTH, MAX_LISTS, NOTE_MAX_LENGTH } from '../../shared/limits'
import { toListIcon } from '../../shared/listIcon'
import { isSection } from '../../shared/listItems'
import { clampListWidth } from '../../shared/listWidth'
import { sameLook } from '../domain/lineLooks'
import type {
  AppState,
  ChartSettings,
  Indicators,
  ListItem,
  SymbolInfo,
  SymbolList,
  ThemeName,
  Timeframe,
  Drawing,
  DrawingKind,
  LineLook,
  WatchlistSort,
} from '../../shared/types'

export type Tool = 'cursor' | 'trendline' | 'hline' | 'channel' | 'rect' | 'measure'

export type Action =
  | { type: 'setTheme'; theme: ThemeName }
  | { type: 'setSymbol'; symbol: string }
  | { type: 'setTimeframe'; timeframe: Timeframe }
  | { type: 'addToWatchlist'; info: SymbolInfo }
  | { type: 'removeFromWatchlist'; symbol: string }
  | { type: 'moveInWatchlist'; from: number; to: number }
  | { type: 'createWatchlist'; id: string; name: string }
  | { type: 'renameWatchlist'; id: string; name: string }
  | { type: 'setWatchlistIcon'; id: string; icon: string | null }
  | { type: 'duplicateWatchlist'; id: string; newId: string }
  | { type: 'deleteWatchlist'; id: string }
  | { type: 'selectWatchlist'; id: string }
  | { type: 'setIndicators'; indicators: Indicators }
  | { type: 'setChart'; chart: ChartSettings }
  | { type: 'setLines'; symbol: string; lines: Drawing[] }
  | { type: 'importConfig'; config: AppState }
  | { type: 'setListWidth'; width: number }
  | { type: 'addSection'; id: string; title: string }
  | { type: 'renameSection'; id: string; title: string }
  | { type: 'removeSection'; id: string }
  | { type: 'setNote'; symbol: string; text: string }
  | { type: 'toggleSecondChart' }
  | { type: 'setSecondChart'; timeframe: Timeframe }
  | { type: 'setWatchlistSort'; sort: WatchlistSort | null }
  | { type: 'rememberLook'; kind: DrawingKind; look: LineLook }

const COPY_SUFFIXES = [' (copy)', ...Array.from({ length: MAX_LISTS }, (_, index) => ` (copy ${index + 2})`)]

const sameSymbol = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase()

export const activeWatchlist = (state: AppState): SymbolList =>
  state.watchlists.find((list) => list.id === state.activeWatchlistId) ?? state.watchlists[0]

const withActiveItems = (state: AppState, items: ListItem[]): AppState => {
  const active = activeWatchlist(state)
  return { ...state, watchlists: state.watchlists.map((list) => (list === active ? { ...list, items } : list)) }
}

const setSymbol = (state: AppState, raw: string): AppState => {
  const symbol = raw.trim().toUpperCase()
  if (!symbol || symbol === state.symbol) return state
  return { ...state, symbol }
}

const addToWatchlist = (state: AppState, info: SymbolInfo): AppState => {
  const { items } = activeWatchlist(state)
  if (items.some((item) => !isSection(item) && sameSymbol(item.symbol, info.symbol))) return state
  return withActiveItems(state, [...items, info])
}

const removeFromWatchlist = (state: AppState, symbol: string): AppState => {
  const { items } = activeWatchlist(state)
  const remaining = items.filter((item) => isSection(item) || !sameSymbol(item.symbol, symbol))
  if (remaining.length === items.length) return state
  return withActiveItems(state, remaining)
}

const moveInWatchlist = (state: AppState, from: number, to: number): AppState => {
  const { items } = activeWatchlist(state)
  const last = items.length - 1
  if (from === to || from < 0 || to < 0 || from > last || to > last) return state
  const reordered = [...items]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(to, 0, moved)
  return withActiveItems(state, reordered)
}

const createWatchlist = (state: AppState, id: string, rawName: string): AppState => {
  const name = rawName.trim()
  const taken = state.watchlists.some((list) => list.id === id)
  if (!name || !id || taken || state.watchlists.length >= MAX_LISTS) return state
  return { ...state, watchlists: [...state.watchlists, { id, name, items: [] }], activeWatchlistId: id }
}

const renameWatchlist = (state: AppState, id: string, rawName: string): AppState => {
  const name = rawName.trim()
  const target = state.watchlists.find((list) => list.id === id)
  if (!name || !target || target.name === name) return state
  return { ...state, watchlists: state.watchlists.map((list) => (list === target ? { ...list, name } : list)) }
}

const setWatchlistIcon = (state: AppState, id: string, raw: string | null): AppState => {
  const target = state.watchlists.find((list) => list.id === id)
  const icon = toListIcon(raw)
  if (!target || (target.icon ?? null) === icon) return state
  const { icon: _old, ...plain } = target
  const updated: SymbolList = icon ? { ...plain, icon } : plain
  return { ...state, watchlists: state.watchlists.map((list) => (list === target ? updated : list)) }
}

const withSuffix = (name: string, suffix: string): string =>
  `${name.slice(0, LIST_NAME_MAX_LENGTH - suffix.length)}${suffix}`

const copyNameFor = (name: string, taken: string[]): string =>
  withSuffix(name, COPY_SUFFIXES.find((suffix) => !taken.includes(withSuffix(name, suffix))) ?? COPY_SUFFIXES[0])

const duplicateWatchlist = (state: AppState, id: string, newId: string): AppState => {
  const index = state.watchlists.findIndex((list) => list.id === id)
  const taken = state.watchlists.some((list) => list.id === newId)
  if (index < 0 || !newId || taken || state.watchlists.length >= MAX_LISTS) return state
  const source = state.watchlists[index]
  const copy: SymbolList = {
    id: newId,
    name: copyNameFor(
      source.name,
      state.watchlists.map((list) => list.name),
    ),
    items: source.items.map((item) => ({ ...item })),
    ...(source.icon ? { icon: source.icon } : {}),
  }
  return {
    ...state,
    watchlists: [...state.watchlists.slice(0, index + 1), copy, ...state.watchlists.slice(index + 1)],
    activeWatchlistId: newId,
  }
}

const deleteWatchlist = (state: AppState, id: string): AppState => {
  const index = state.watchlists.findIndex((list) => list.id === id)
  if (index < 0 || state.watchlists.length <= 1) return state
  const watchlists = state.watchlists.filter((list) => list.id !== id)
  const wasActive = activeWatchlist(state).id === id
  return {
    ...state,
    watchlists,
    activeWatchlistId: wasActive ? watchlists[Math.max(index - 1, 0)].id : state.activeWatchlistId,
  }
}

const selectWatchlist = (state: AppState, id: string): AppState => {
  if (id === state.activeWatchlistId || !state.watchlists.some((list) => list.id === id)) return state
  return { ...state, activeWatchlistId: id }
}

const setListWidth = (state: AppState, raw: number): AppState => {
  const listWidth = clampListWidth(raw)
  return listWidth === state.listWidth ? state : { ...state, listWidth }
}

const addSection = (state: AppState, id: string, rawTitle: string): AppState => {
  const title = rawTitle.trim().slice(0, LIST_NAME_MAX_LENGTH)
  const { items } = activeWatchlist(state)
  if (!title || !id || items.some((item) => isSection(item) && item.id === id)) return state
  return withActiveItems(state, [...items, { kind: 'section', id, title }])
}

const renameSection = (state: AppState, id: string, rawTitle: string): AppState => {
  const title = rawTitle.trim().slice(0, LIST_NAME_MAX_LENGTH)
  const { items } = activeWatchlist(state)
  const target = items.find((item) => isSection(item) && item.id === id)
  if (!title || !target || (isSection(target) && target.title === title)) return state
  return withActiveItems(
    state,
    items.map((item) => (item === target ? { kind: 'section', id, title } : item)),
  )
}

const removeSection = (state: AppState, id: string): AppState => {
  const { items } = activeWatchlist(state)
  const remaining = items.filter((item) => !isSection(item) || item.id !== id)
  return remaining.length === items.length ? state : withActiveItems(state, remaining)
}

const setNote = (state: AppState, symbol: string, rawText: string): AppState => {
  const text = rawText.slice(0, NOTE_MAX_LENGTH)
  const { [symbol]: previous, ...others } = state.notes
  if ((previous ?? '') === text) return state
  return { ...state, notes: text ? { ...others, [symbol]: text } : others }
}

const toggleSecondChart = (state: AppState): AppState => {
  const other: Timeframe = state.timeframe === 'D' ? 'W' : 'D'
  return { ...state, secondChart: state.secondChart ? null : other }
}

const setSecondChart = (state: AppState, timeframe: Timeframe): AppState =>
  state.secondChart === null || state.secondChart === timeframe ? state : { ...state, secondChart: timeframe }

const setLines = (state: AppState, symbol: string, lines: Drawing[]): AppState => {
  const { [symbol]: _previous, ...others } = state.lines
  return { ...state, lines: lines.length > 0 ? { ...others, [symbol]: lines } : others }
}

const rememberLook = (state: AppState, kind: DrawingKind, look: LineLook): AppState =>
  sameLook(state.lineLooks[kind], look) ? state : { ...state, lineLooks: { ...state.lineLooks, [kind]: look } }

export const appReducer = (state: AppState, action: Action): AppState => {
  if (action.type === 'setTheme') return action.theme === state.theme ? state : { ...state, theme: action.theme }
  if (action.type === 'setTimeframe') {
    return action.timeframe === state.timeframe ? state : { ...state, timeframe: action.timeframe }
  }
  if (action.type === 'setSymbol') return setSymbol(state, action.symbol)
  if (action.type === 'addToWatchlist') return addToWatchlist(state, action.info)
  if (action.type === 'removeFromWatchlist') return removeFromWatchlist(state, action.symbol)
  if (action.type === 'moveInWatchlist') return moveInWatchlist(state, action.from, action.to)
  if (action.type === 'createWatchlist') return createWatchlist(state, action.id, action.name)
  if (action.type === 'renameWatchlist') return renameWatchlist(state, action.id, action.name)
  if (action.type === 'setWatchlistIcon') return setWatchlistIcon(state, action.id, action.icon)
  if (action.type === 'duplicateWatchlist') return duplicateWatchlist(state, action.id, action.newId)
  if (action.type === 'deleteWatchlist') return deleteWatchlist(state, action.id)
  if (action.type === 'selectWatchlist') return selectWatchlist(state, action.id)
  if (action.type === 'setIndicators') return { ...state, indicators: action.indicators }
  if (action.type === 'setChart') return { ...state, chart: action.chart }
  if (action.type === 'importConfig') return { ...action.config, rev: state.rev }
  if (action.type === 'setListWidth') return setListWidth(state, action.width)
  if (action.type === 'addSection') return addSection(state, action.id, action.title)
  if (action.type === 'renameSection') return renameSection(state, action.id, action.title)
  if (action.type === 'removeSection') return removeSection(state, action.id)
  if (action.type === 'setNote') return setNote(state, action.symbol, action.text)
  if (action.type === 'toggleSecondChart') return toggleSecondChart(state)
  if (action.type === 'setSecondChart') return setSecondChart(state, action.timeframe)
  if (action.type === 'setWatchlistSort') return { ...state, watchlistSort: action.sort }
  if (action.type === 'rememberLook') return rememberLook(state, action.kind, action.look)
  return setLines(state, action.symbol, action.lines)
}
