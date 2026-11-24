import type { ListItem, ListSection, SymbolInfo } from './types'

export const isSection = (item: ListItem): item is ListSection => 'kind' in item

export const symbolsOf = (items: ListItem[]): SymbolInfo[] =>
  items.filter((item): item is SymbolInfo => !isSection(item))
