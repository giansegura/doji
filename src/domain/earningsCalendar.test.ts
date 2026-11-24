import { expect, test } from 'vitest'
import type { Earnings, SymbolList } from '../../shared/types'
import { calendarEntries, calendarItems, calendarWeek, earningsSoon, shiftWeek, weekStart } from './earningsCalendar'

const lists: SymbolList[] = [
  {
    id: 'tech',
    name: 'Tecnología',
    items: [
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
      { kind: 'section', id: 's', title: 'Chips' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
    ],
  },
  { id: 'fav', name: 'Hola', items: [{ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }, { symbol: 'BRK-B', name: 'Berkshire Hathaway', exchange: 'NYSE' }] },
]

const earnings: Record<string, Earnings> = {
  AAPL: { past: ['2026-11-02'], next: '2027-01-28', nextIsEstimate: false, timing: { '2026-11-02': 'post', '2027-01-28': 'post' } },
  NVDA: { past: ['2026-11-18'], next: '2027-02-24', nextIsEstimate: true, timing: { '2026-11-18': 'post' } },
  'BRK-B': { past: ['2026-11-07'], next: null, nextIsEstimate: false },
}

test('Should gather every symbol once with the lists it belongs to', () => {
  expect(calendarItems(lists)).toEqual([
    { symbol: 'AAPL', name: 'Apple Inc.', lists: ['tech', 'fav'] },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', lists: ['tech'] },
    { symbol: 'BRK-B', name: 'Berkshire Hathaway', lists: ['fav'] },
  ])
})

test('Should turn the earnings into dated entries, past and next, with their timing and whether the date is a guess', () => {
  const entries = calendarEntries(calendarItems(lists), earnings)
  expect(entries).toContainEqual({
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    lists: ['tech'],
    date: '2027-02-24',
    kind: 'next',
    estimate: true,
    timing: null,
  })
  expect(entries).toContainEqual({
    symbol: 'AAPL',
    name: 'Apple Inc.',
    lists: ['tech', 'fav'],
    date: '2026-11-02',
    kind: 'past',
    estimate: false,
    timing: 'post',
  })
  expect(entries).toHaveLength(5)
})

test('Should lay a week out from Monday to Friday and add the weekend only when someone reports then', () => {
  const entries = calendarEntries(calendarItems(lists), earnings)
  const week = calendarWeek(entries, weekStart('2026-11-04'), null)
  expect(week.map((day) => day.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'])
  expect(week[0].entries.map((entry) => entry.symbol)).toEqual(['AAPL'])
  expect(week[5].entries.map((entry) => entry.symbol)).toEqual(['BRK-B'])
  expect(calendarWeek(entries, '2026-11-16', null).map((day) => day.date)).toHaveLength(5)
})

test('Should show only the symbols of the chosen list', () => {
  const entries = calendarEntries(calendarItems(lists), earnings)
  expect(calendarWeek(entries, '2026-11-02', 'tech').flatMap((day) => day.entries.map((entry) => entry.symbol))).toEqual(['AAPL'])
  expect(calendarWeek(entries, '2026-11-02', 'fav').flatMap((day) => day.entries.map((entry) => entry.symbol))).toEqual(['AAPL', 'BRK-B'])
})

test('Should put the reports before the opening first in a day, then the unknown, then the ones after the close', () => {
  const day = '2026-12-01'
  const many: Record<string, Earnings> = {
    AAPL: { past: [], next: day, nextIsEstimate: false, timing: { [day]: 'post' } },
    NVDA: { past: [], next: day, nextIsEstimate: false },
    'BRK-B': { past: [], next: day, nextIsEstimate: false, timing: { [day]: 'pre' } },
  }
  const [monday] = calendarWeek(calendarEntries(calendarItems(lists), many), day, null)
  expect(monday.entries.map((entry) => entry.symbol)).toEqual(['BRK-B', 'NVDA', 'AAPL'])
})

test('Should move from week to week', () => {
  expect(weekStart('2026-11-29')).toBe('2026-11-23')
  expect(shiftWeek('2026-11-23', 1)).toBe('2026-11-30')
  expect(shiftWeek('2026-11-23', -2)).toBe('2026-11-09')
})

test('Should tell how many days are left for the symbols that report within a week', () => {
  const soon: Record<string, Earnings> = {
    AAPL: { past: [], next: '2026-11-26', nextIsEstimate: false },
    NVDA: { past: [], next: '2026-12-10', nextIsEstimate: false },
    'BRK-B': { past: [], next: '2026-11-24', nextIsEstimate: true },
  }
  expect(earningsSoon(soon, '2026-11-24')).toEqual({ AAPL: 2, 'BRK-B': 0 })
})
