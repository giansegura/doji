import type { AppState, TrendLine } from './types'

const PARTS = ['theme', 'symbol', 'timeframe', 'watchlists', 'activeWatchlistId', 'indicators', 'chart'] as const

type Part = (typeof PARTS)[number]

export type StateChanges = Partial<Pick<AppState, Part>> & { lines?: Record<string, TrendLine[]> }

export const changesSince = (saved: AppState, current: AppState): StateChanges => {
  const parts = Object.fromEntries(PARTS.filter((part) => current[part] !== saved[part]).map((part) => [part, current[part]]))
  const symbols = [...new Set([...Object.keys(saved.lines), ...Object.keys(current.lines)])]
  const changed = symbols.filter((symbol) => current.lines[symbol] !== saved.lines[symbol])
  if (changed.length === 0) return parts
  return { ...parts, lines: Object.fromEntries(changed.map((symbol) => [symbol, current.lines[symbol] ?? []])) }
}

export const applyChanges = (state: AppState, changes: StateChanges): AppState => {
  const { lines, ...parts } = changes
  const merged = Object.entries({ ...state.lines, ...lines }).filter(([, list]) => list.length > 0)
  return { ...state, ...parts, lines: Object.fromEntries(merged) }
}
