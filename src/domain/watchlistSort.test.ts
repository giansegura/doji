import { expect, test } from 'vitest'
import type { SymbolMetrics } from '../../shared/symbolMetrics'
import type { Earnings, ListItem, Quote, WatchlistSort } from '../../shared/types'
import { nextSort, sortItems } from './watchlistSort'

const item = (symbol: string): ListItem => ({ symbol, name: symbol, exchange: 'NYSE' })
const section = (id: string): ListItem => ({ kind: 'section', id, title: id })

const quote = (symbol: string, price: number, changePercent: number, extended: number | null = null): Quote => ({
  symbol,
  price,
  change: 0,
  changePercent,
  extended: extended === null ? null : { session: 'pre', price, changePercent: extended },
})

const quotes: Record<string, Quote> = {
  KO: quote('KO', 60, 1.5, -0.2),
  PEP: quote('PEP', 140, -0.8, 0.4),
  AAPL: quote('AAPL', 349, 3.1),
  MSFT: quote('MSFT', 492, 0.2, 1.1),
}

const symbols = (items: ListItem[]): string[] => items.map((entry) => ('kind' in entry ? `[${entry.title}]` : entry.symbol))

const sorted = (items: ListItem[], sort: WatchlistSort | null) => symbols(sortItems(items, quotes, sort))

const plain = ['PEP', 'KO', 'MSFT', 'AAPL'].map(item)

test('Should keep the order of the user when the list is not sorted', () => {
  expect(sortItems(plain, quotes, null)).toBe(plain)
})

test('Should sort by the change of the day, highest or lowest first', () => {
  expect(sorted(plain, { column: 'change', direction: 'desc' })).toEqual(['AAPL', 'KO', 'MSFT', 'PEP'])
  expect(sorted(plain, { column: 'change', direction: 'asc' })).toEqual(['PEP', 'MSFT', 'KO', 'AAPL'])
})

test('Should sort by the last price and by the change outside regular hours', () => {
  expect(sorted(plain, { column: 'last', direction: 'desc' })).toEqual(['MSFT', 'AAPL', 'PEP', 'KO'])
  expect(sorted(plain, { column: 'ext', direction: 'desc' })).toEqual(['MSFT', 'PEP', 'KO', 'AAPL'])
})

test('Should sort by symbol in alphabetical order or its reverse', () => {
  expect(sorted(plain, { column: 'symbol', direction: 'asc' })).toEqual(['AAPL', 'KO', 'MSFT', 'PEP'])
  expect(sorted(plain, { column: 'symbol', direction: 'desc' })).toEqual(['PEP', 'MSFT', 'KO', 'AAPL'])
})

test('Should leave the symbols without a value at the end whichever the direction', () => {
  const withUnknown = [item('ZZZ'), ...plain]
  expect(sorted(withUnknown, { column: 'change', direction: 'desc' }).at(-1)).toBe('ZZZ')
  expect(sorted(withUnknown, { column: 'change', direction: 'asc' }).at(-1)).toBe('ZZZ')
  expect(sorted(plain, { column: 'ext', direction: 'asc' })).toEqual(['KO', 'PEP', 'MSFT', 'AAPL'])
})

test('Should sort inside each section and keep the sections where they are', () => {
  const grouped = [item('PEP'), section('Cartera'), item('KO'), item('AAPL'), section('Vigilando'), item('PEP2'), item('MSFT')]
  expect(sorted(grouped, { column: 'change', direction: 'desc' })).toEqual([
    'PEP',
    '[Cartera]',
    'AAPL',
    'KO',
    '[Vigilando]',
    'MSFT',
    'PEP2',
  ])
})

test('Should keep the order of the user among symbols with the same value', () => {
  const twins = { ...quotes, PEP: quote('PEP', 140, 1.5) }
  expect(symbols(sortItems(plain, twins, { column: 'change', direction: 'desc' }))).toEqual(['AAPL', 'PEP', 'KO', 'MSFT'])
})

test('Should sort a column the first time, reverse it the second and stop sorting the third', () => {
  const first = nextSort(null, 'change')
  expect(first).toEqual({ column: 'change', direction: 'desc' })
  const second = nextSort(first, 'change')
  expect(second).toEqual({ column: 'change', direction: 'asc' })
  expect(nextSort(second, 'change')).toBeNull()
})

test('Should start the symbol column from A to Z', () => {
  expect(nextSort(null, 'symbol')).toEqual({ column: 'symbol', direction: 'asc' })
  expect(nextSort({ column: 'symbol', direction: 'asc' }, 'symbol')).toEqual({ column: 'symbol', direction: 'desc' })
})

test('Should start over on another column', () => {
  expect(nextSort({ column: 'change', direction: 'asc' }, 'last')).toEqual({ column: 'last', direction: 'desc' })
})

const metricsOf = (rsi: number, fromHighPercent: number, volumeRatio: number, percent: number): SymbolMetrics => ({
  rsi,
  fromHighPercent,
  volumeRatio,
  level: { price: 1, kind: percent > 0 ? 'resistance' : 'support', percent },
  changePercent: 0,
  vsSma50Percent: 0,
  vsSma200Percent: 0,
})

const extras = {
  metrics: {
    KO: metricsOf(48, -2, 0.9, 1.5),
    PEP: metricsOf(71, -12, 2.4, -0.4),
    AAPL: metricsOf(55, -0.5, 1.1, -3),
  },
  earnings: {
    KO: { past: [], next: '2027-02-10', nextIsEstimate: false },
    PEP: { past: [], next: '2027-02-03', nextIsEstimate: true },
    MSFT: { past: [], next: null, nextIsEstimate: false },
  } as Record<string, Earnings>,
}

const sortedBy = (sort: WatchlistSort) => symbols(sortItems(plain, quotes, sort, extras))

test('Should sort by the RSI, the distance to the yearly high and the volume against its average', () => {
  expect(sortedBy({ column: 'rsi', direction: 'desc' })).toEqual(['PEP', 'AAPL', 'KO', 'MSFT'])
  expect(sortedBy({ column: 'fromHigh', direction: 'desc' })).toEqual(['AAPL', 'KO', 'PEP', 'MSFT'])
  expect(sortedBy({ column: 'relVolume', direction: 'desc' })).toEqual(['PEP', 'AAPL', 'KO', 'MSFT'])
})

test('Should sort by the soonest earnings and by the nearest level, whichever its side', () => {
  expect(sortedBy({ column: 'earnings', direction: 'asc' })).toEqual(['PEP', 'KO', 'MSFT', 'AAPL'])
  expect(sortedBy({ column: 'level', direction: 'asc' })).toEqual(['PEP', 'KO', 'AAPL', 'MSFT'])
})

test('Should start with the soonest earnings and the nearest level, and with the highest of the rest', () => {
  expect(nextSort(null, 'earnings')).toEqual({ column: 'earnings', direction: 'asc' })
  expect(nextSort(null, 'level')).toEqual({ column: 'level', direction: 'asc' })
  expect(nextSort(null, 'rsi')).toEqual({ column: 'rsi', direction: 'desc' })
})

test('Should sort by flag in the order of the palette, with the symbols without one at the end', () => {
  const flags = { KO: 'blue', PEP: 'red', MSFT: 'green' } as const
  expect(symbols(sortItems(plain, quotes, { column: 'flag', direction: 'asc' }, { ...extras, flags }))).toEqual(['PEP', 'MSFT', 'KO', 'AAPL'])
  expect(symbols(sortItems(plain, quotes, { column: 'flag', direction: 'desc' }, { ...extras, flags }))).toEqual(['KO', 'MSFT', 'PEP', 'AAPL'])
  expect(nextSort(null, 'flag')).toEqual({ column: 'flag', direction: 'asc' })
})
