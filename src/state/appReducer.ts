import { LIST_NAME_MAX_LENGTH, MAX_LISTS } from '../../shared/limits'
import type {
  AppState,
  ChartSettings,
  Indicators,
  SymbolInfo,
  SymbolList,
  ThemeName,
  Timeframe,
  TrendLine,
} from '../../shared/types'

export type Tool = 'cursor' | 'trendline'

export type Action =
  | { type: 'setTheme'; theme: ThemeName }
  | { type: 'setSymbol'; symbol: string }
  | { type: 'setTimeframe'; timeframe: Timeframe }
  | { type: 'addToWatchlist'; info: SymbolInfo }
  | { type: 'removeFromWatchlist'; symbol: string }
  | { type: 'moveInWatchlist'; from: number; to: number }
  | { type: 'createWatchlist'; id: string; name: string }
  | { type: 'renameWatchlist'; id: string; name: string }
  | { type: 'duplicateWatchlist'; id: string; newId: string }
  | { type: 'deleteWatchlist'; id: string }
  | { type: 'selectWatchlist'; id: string }
  | { type: 'setIndicators'; indicators: Indicators }
  | { type: 'setChart'; chart: ChartSettings }
  | { type: 'setLines'; symbol: string; lines: TrendLine[] }

const COPY_SUFFIXES = [' (copia)', ...Array.from({ length: MAX_LISTS }, (_, index) => ` (copia ${index + 2})`)]

const sameSymbol = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase()

export const activeWatchlist = (state: AppState): SymbolList =>
  state.watchlists.find((list) => list.id === state.activeWatchlistId) ?? state.watchlists[0]

const withActiveItems = (state: AppState, items: SymbolInfo[]): AppState => {
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
  if (items.some((item) => sameSymbol(item.symbol, info.symbol))) return state
  return withActiveItems(state, [...items, info])
}

const removeFromWatchlist = (state: AppState, symbol: string): AppState => {
  const { items } = activeWatchlist(state)
  const remaining = items.filter((item) => !sameSymbol(item.symbol, symbol))
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

const setLines = (state: AppState, symbol: string, lines: TrendLine[]): AppState => {
  const { [symbol]: _previous, ...others } = state.lines
  return { ...state, lines: lines.length > 0 ? { ...others, [symbol]: lines } : others }
}

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
  if (action.type === 'duplicateWatchlist') return duplicateWatchlist(state, action.id, action.newId)
  if (action.type === 'deleteWatchlist') return deleteWatchlist(state, action.id)
  if (action.type === 'selectWatchlist') return selectWatchlist(state, action.id)
  if (action.type === 'setIndicators') return { ...state, indicators: action.indicators }
  if (action.type === 'setChart') return { ...state, chart: action.chart }
  return setLines(state, action.symbol, action.lines)
}
