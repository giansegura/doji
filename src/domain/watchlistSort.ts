import { isSection } from '../../shared/listItems'
import { displaySymbol } from '../../shared/symbols'
import type { ListItem, Quote, SortColumn, SymbolInfo, WatchlistSort } from '../../shared/types'

type Value = number | string | null

const valueOf = (item: SymbolInfo, quote: Quote | undefined, column: SortColumn): Value => {
  if (column === 'symbol') return displaySymbol(item.symbol)
  if (column === 'last') return quote?.price ?? null
  if (column === 'change') return quote?.changePercent ?? null
  return quote?.extended?.changePercent ?? null
}

const compare = (a: Value, b: Value, direction: number): number => {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  if (typeof a === 'string' || typeof b === 'string') return String(a).localeCompare(String(b)) * direction
  return (a - b) * direction
}

const sortBlock = (block: SymbolInfo[], quotes: Record<string, Quote>, sort: WatchlistSort): SymbolInfo[] => {
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...block].sort((a, b) =>
    compare(valueOf(a, quotes[a.symbol], sort.column), valueOf(b, quotes[b.symbol], sort.column), direction),
  )
}

export const sortItems = (items: ListItem[], quotes: Record<string, Quote>, sort: WatchlistSort | null): ListItem[] => {
  if (!sort) return items
  const out: ListItem[] = []
  let block: SymbolInfo[] = []
  items.forEach((item) => {
    if (!isSection(item)) {
      block.push(item)
      return
    }
    out.push(...sortBlock(block, quotes, sort), item)
    block = []
  })
  return [...out, ...sortBlock(block, quotes, sort)]
}

export const nextSort = (current: WatchlistSort | null, column: SortColumn): WatchlistSort | null => {
  const first = column === 'symbol' ? 'asc' : 'desc'
  if (current?.column !== column) return { column, direction: first }
  return current.direction === first ? { column, direction: first === 'asc' ? 'desc' : 'asc' } : null
}
