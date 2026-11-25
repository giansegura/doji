import { expect, test } from 'vitest'
import type { SymbolMetrics } from '../../shared/symbolMetrics'
import type { Earnings, ListItem, SavedFilter, SymbolList } from '../../shared/types'
import { allSymbols, describeCondition, filterItems, matchesFilter } from './filters'

const metricsOf = (over: Partial<SymbolMetrics> = {}): SymbolMetrics => ({
  rsi: 50,
  fromHighPercent: -5,
  volumeRatio: 1,
  level: { price: 100, kind: 'support', percent: -1.5 },
  changePercent: 0.5,
  vsSma50Percent: 2,
  vsSma200Percent: 8,
  ...over,
})

const filterOf = (conditions: SavedFilter['conditions'], scope: SavedFilter['scope'] = 'list'): SavedFilter => ({
  id: 'f',
  name: 'F',
  scope,
  conditions,
})

const earningsOn = (next: string | null): Earnings => ({ past: [], next, nextIsEstimate: false })

const context = (metrics: Record<string, SymbolMetrics>, earnings: Record<string, Earnings> = {}) => ({
  metrics,
  earnings,
  today: '2026-11-25',
})

test('Should match a symbol only when every condition holds', () => {
  const filter = filterOf([
    { field: 'rsi', op: 'below', value: 30 },
    { field: 'vsSma200', op: 'above', value: 0 },
  ])
  expect(matchesFilter(filter, 'KO', context({ KO: metricsOf({ rsi: 28 }) }))).toBe(true)
  expect(matchesFilter(filter, 'KO', context({ KO: metricsOf({ rsi: 28, vsSma200Percent: -1 }) }))).toBe(false)
  expect(matchesFilter(filter, 'KO', context({ KO: metricsOf({ rsi: 45 }) }))).toBe(false)
  expect(matchesFilter(filter, 'KO', context({}))).toBe(false)
})

test('Should read each field from the values of the columns', () => {
  const values = context({ KO: metricsOf() }, { KO: earningsOn('2026-12-02') })
  const holds = (condition: SavedFilter['conditions'][number]) => matchesFilter(filterOf([condition]), 'KO', values)
  expect(holds({ field: 'change', op: 'above', value: 0.4 })).toBe(true)
  expect(holds({ field: 'fromHigh', op: 'above', value: -6 })).toBe(true)
  expect(holds({ field: 'relVolume', op: 'above', value: 1.5 })).toBe(false)
  expect(holds({ field: 'level', op: 'below', value: 2 })).toBe(true)
  expect(holds({ field: 'vsSma50', op: 'below', value: 1 })).toBe(false)
  expect(holds({ field: 'earningsDays', op: 'below', value: 8 })).toBe(true)
  expect(holds({ field: 'earningsDays', op: 'below', value: 6 })).toBe(false)
})

test('Should not match a field it does not know yet', () => {
  const values = context({ KO: metricsOf({ level: null, rsi: null }) }, { KO: earningsOn(null) })
  expect(matchesFilter(filterOf([{ field: 'level', op: 'below', value: 5 }]), 'KO', values)).toBe(false)
  expect(matchesFilter(filterOf([{ field: 'rsi', op: 'below', value: 100 }]), 'KO', values)).toBe(false)
  expect(matchesFilter(filterOf([{ field: 'earningsDays', op: 'below', value: 100 }]), 'KO', values)).toBe(false)
})

test('Should keep the matching symbols and the sections that still have one', () => {
  const items: ListItem[] = [
    { kind: 'section', id: 'a', title: 'A' },
    { symbol: 'KO', name: 'KO', exchange: 'NYSE' },
    { kind: 'section', id: 'b', title: 'B' },
    { symbol: 'PEP', name: 'PEP', exchange: 'NASDAQ' },
  ]
  const filter = filterOf([{ field: 'rsi', op: 'below', value: 30 }])
  const kept = filterItems(items, filter, context({ KO: metricsOf({ rsi: 60 }), PEP: metricsOf({ rsi: 25 }) }))
  expect(kept).toEqual([items[2], items[3]])
})

test('Should gather every symbol of every list once, in the order of the lists', () => {
  const lists: SymbolList[] = [
    { id: 'a', name: 'A', items: [{ symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }, { kind: 'section', id: 's', title: 'S' }] },
    { id: 'b', name: 'B', items: [{ symbol: 'PEP', name: 'PepsiCo', exchange: 'NASDAQ' }, { symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }] },
  ]
  expect(allSymbols(lists).map((item) => item.symbol)).toEqual(['KO', 'PEP'])
})

test('Should describe a condition in words', () => {
  expect(describeCondition({ field: 'rsi', op: 'below', value: 30 })).toBe('RSI 14 below 30')
  expect(describeCondition({ field: 'vsSma200', op: 'above', value: 0 })).toBe('vs SMA 200 above 0%')
  expect(describeCondition({ field: 'earningsDays', op: 'below', value: 7 })).toBe('Days to earnings below 7')
  expect(describeCondition({ field: 'relVolume', op: 'above', value: 1.5 })).toBe('Volume vs average above 1.5×')
})
