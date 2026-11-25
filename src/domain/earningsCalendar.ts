import { addDays, mondayOf } from '../../shared/dates'
import { isSection } from '../../shared/listItems'
import type { Earnings, EarningsTiming, SymbolList } from '../../shared/types'

export type CalendarItem = { symbol: string; name: string; lists: string[] }

export type CalendarEntry = CalendarItem & {
  date: string
  kind: 'past' | 'next'
  estimate: boolean
  timing: EarningsTiming | null
}

export type CalendarDay = { date: string; entries: CalendarEntry[] }

const WORKDAYS = 5
const WEEK = 7
const DAY_MS = 86_400_000
const SOON_DAYS = 7
const TIMING_ORDER: Record<string, number> = { pre: 0, none: 1, post: 2 }

export const weekStart = (date: string): string => mondayOf(date)

export const shiftWeek = (monday: string, weeks: number): string => addDays(monday, weeks * WEEK)

export const calendarItems = (lists: SymbolList[]): CalendarItem[] => {
  const items = new Map<string, CalendarItem>()
  lists.forEach((list) =>
    list.items.forEach((item) => {
      if (isSection(item)) return
      const known = items.get(item.symbol)
      if (known) known.lists = known.lists.includes(list.id) ? known.lists : [...known.lists, list.id]
      else items.set(item.symbol, { symbol: item.symbol, name: item.name, lists: [list.id] })
    }),
  )
  return [...items.values()]
}

export const calendarEntries = (items: CalendarItem[], earnings: Record<string, Earnings>): CalendarEntry[] =>
  items.flatMap((item) => {
    const found = earnings[item.symbol.toUpperCase()] ?? earnings[item.symbol]
    if (!found) return []
    const timingOf = (date: string): EarningsTiming | null => found.timing?.[date] ?? null
    const past = found.past.map((date): CalendarEntry => ({ ...item, date, kind: 'past', estimate: false, timing: timingOf(date) }))
    const next = found.next
      ? [{ ...item, date: found.next, kind: 'next' as const, estimate: found.nextIsEstimate, timing: timingOf(found.next) }]
      : []
    return [...past, ...next]
  })

const byTimingThenSymbol = (first: CalendarEntry, second: CalendarEntry): number =>
  TIMING_ORDER[first.timing ?? 'none'] - TIMING_ORDER[second.timing ?? 'none'] || first.symbol.localeCompare(second.symbol)

export const calendarWeek = (entries: CalendarEntry[], monday: string, listId: string | null): CalendarDay[] => {
  const shown = entries.filter((entry) => listId === null || entry.lists.includes(listId))
  const onDays = (dates: string[]): CalendarEntry[] => shown.filter((entry) => dates.includes(entry.date)).sort(byTimingThenSymbol)
  const workdays = Array.from({ length: WORKDAYS }, (_, index) => addDays(monday, index))
  const weekend = [addDays(monday, WORKDAYS), addDays(monday, WORKDAYS + 1)]
  const days = workdays.map((date) => ({ date, entries: onDays([date]) }))
  const weekendEntries = onDays(weekend)
  return weekendEntries.length > 0 ? [...days, { date: weekend[0], entries: weekendEntries }] : days
}

export const daysUntil = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

export const earningsSoon = (earnings: Record<string, Earnings>, today: string, within = SOON_DAYS): Record<string, number> =>
  Object.fromEntries(
    Object.entries(earnings).flatMap(([symbol, found]) => {
      const left = found.next ? daysUntil(today, found.next) : null
      return left !== null && left >= 0 && left <= within ? [[symbol, left]] : []
    }),
  )
