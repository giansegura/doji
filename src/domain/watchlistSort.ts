import { isSection } from '../../shared/listItems'
import { displaySymbol } from '../../shared/symbols'
import type { SymbolMetrics } from '../../shared/symbolMetrics'
import { FLAG_COLORS } from '../../shared/flags'
import type { Earnings, FlagColor, ListItem, Quote, SortColumn, SymbolInfo, WatchlistSort } from '../../shared/types'

type Value = number | string | null

export type SortExtras = {
  metrics: Record<string, SymbolMetrics>
  earnings: Record<string, Earnings>
  flags?: Record<string, FlagColor>
}

const NO_EXTRAS: SortExtras = { metrics: {}, earnings: {} }

const ASCENDING_FIRST: SortColumn[] = ['symbol', 'flag', 'earnings', 'level']

const valueOf = (item: SymbolInfo, quote: Quote | undefined, column: SortColumn, extras: SortExtras): Value => {
  const metrics = extras.metrics[item.symbol]
  if (column === 'symbol') return displaySymbol(item.symbol)
  if (column === 'last') return quote?.price ?? null
  if (column === 'change') return quote?.changePercent ?? null
  if (column === 'flag') {
    const flag = extras.flags?.[item.symbol]
    return flag ? FLAG_COLORS.indexOf(flag) : null
  }
  if (column === 'rsi') return metrics?.rsi ?? null
  if (column === 'fromHigh') return metrics?.fromHighPercent ?? null
  if (column === 'relVolume') return metrics?.volumeRatio ?? null
  if (column === 'earnings') return extras.earnings[item.symbol]?.next ?? null
  if (column === 'level') return metrics?.level ? Math.abs(metrics.level.percent) : null
  return quote?.extended?.changePercent ?? null
}

const compare = (a: Value, b: Value, direction: number): number => {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  if (typeof a === 'string' || typeof b === 'string') return String(a).localeCompare(String(b)) * direction
  return (a - b) * direction
}

const sortBlock = (block: SymbolInfo[], quotes: Record<string, Quote>, sort: WatchlistSort, extras: SortExtras): SymbolInfo[] => {
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...block].sort((a, b) =>
    compare(valueOf(a, quotes[a.symbol], sort.column, extras), valueOf(b, quotes[b.symbol], sort.column, extras), direction),
  )
}

export const sortItems = (
  items: ListItem[],
  quotes: Record<string, Quote>,
  sort: WatchlistSort | null,
  extras: SortExtras = NO_EXTRAS,
): ListItem[] => {
  if (!sort) return items
  const out: ListItem[] = []
  let block: SymbolInfo[] = []
  items.forEach((item) => {
    if (!isSection(item)) {
      block.push(item)
      return
    }
    out.push(...sortBlock(block, quotes, sort, extras), item)
    block = []
  })
  return [...out, ...sortBlock(block, quotes, sort, extras)]
}

export const nextSort = (current: WatchlistSort | null, column: SortColumn): WatchlistSort | null => {
  const first = ASCENDING_FIRST.includes(column) ? 'asc' : 'desc'
  if (current?.column !== column) return { column, direction: first }
  return current.direction === first ? { column, direction: first === 'asc' ? 'desc' : 'asc' } : null
}
