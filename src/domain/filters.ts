import { isSection } from '../../shared/listItems'
import type { SymbolMetrics } from '../../shared/symbolMetrics'
import type { Earnings, FilterCondition, FilterField, ListItem, ListSection, SavedFilter, SymbolInfo, SymbolList } from '../../shared/types'
import { daysUntil } from './earningsCalendar'

export type FilterContext = { metrics: Record<string, SymbolMetrics>; earnings: Record<string, Earnings>; today: string }

export const FILTER_FIELD_NAMES: Record<FilterField, { name: string; unit: string }> = {
  change: { name: 'Change', unit: '%' },
  rsi: { name: 'RSI 14', unit: '' },
  fromHigh: { name: 'From 52-week high', unit: '%' },
  relVolume: { name: 'Volume vs average', unit: '×' },
  level: { name: 'Distance to nearest level', unit: '%' },
  vsSma50: { name: 'vs SMA 50', unit: '%' },
  vsSma200: { name: 'vs SMA 200', unit: '%' },
  earningsDays: { name: 'Days to earnings', unit: '' },
}

export const METRIC_FIELDS: FilterField[] = ['change', 'rsi', 'fromHigh', 'relVolume', 'level', 'vsSma50', 'vsSma200']

const valueOf = (field: FilterField, symbol: string, context: FilterContext): number | null => {
  const metrics = context.metrics[symbol]
  if (field === 'earningsDays') {
    const next = context.earnings[symbol]?.next
    return next ? daysUntil(context.today, next) : null
  }
  if (!metrics) return null
  if (field === 'change') return metrics.changePercent
  if (field === 'rsi') return metrics.rsi
  if (field === 'fromHigh') return metrics.fromHighPercent
  if (field === 'relVolume') return metrics.volumeRatio
  if (field === 'level') return metrics.level ? Math.abs(metrics.level.percent) : null
  if (field === 'vsSma50') return metrics.vsSma50Percent
  return metrics.vsSma200Percent
}

const holds = (condition: FilterCondition, symbol: string, context: FilterContext): boolean => {
  const value = valueOf(condition.field, symbol, context)
  if (value === null) return false
  return condition.op === 'above' ? value > condition.value : value < condition.value
}

export const matchesFilter = (filter: SavedFilter, symbol: string, context: FilterContext): boolean =>
  filter.conditions.every((condition) => holds(condition, symbol, context))

export const filterItems = (items: ListItem[], filter: SavedFilter, context: FilterContext): ListItem[] => {
  const kept: ListItem[] = []
  let section: ListSection | null = null
  items.forEach((item) => {
    if (isSection(item)) {
      section = item
      return
    }
    if (!matchesFilter(filter, item.symbol, context)) return
    if (section) kept.push(section)
    section = null
    kept.push(item)
  })
  return kept
}

export const allSymbols = (lists: SymbolList[]): SymbolInfo[] => {
  const seen = new Map<string, SymbolInfo>()
  lists.forEach((list) =>
    list.items.forEach((item) => {
      if (!isSection(item) && !seen.has(item.symbol)) seen.set(item.symbol, item)
    }),
  )
  return [...seen.values()]
}

export const describeCondition = (condition: FilterCondition): string => {
  const { name, unit } = FILTER_FIELD_NAMES[condition.field]
  return `${name} ${condition.op} ${condition.value}${unit}`
}
