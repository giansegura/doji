import { expect, test } from 'vitest'
import type { ListItem, Quote, WatchlistSort } from '../../shared/types'
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
