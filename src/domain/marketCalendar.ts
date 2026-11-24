import { addDays, addWeekdays, weekdayIndex, weekdaysBetween } from '../../shared/dates'

const MONDAY = 0
const THURSDAY = 3
const SATURDAY = 5
const SUNDAY = 6
const JUNETEENTH_SINCE = 2022
const RECENT_DAYS = 400
const MIN_EVIDENCE = 3

const cache = new Map<number, string[]>()

const iso = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const yearOf = (date: string): number => Number(date.slice(0, 4))

const nthWeekday = (year: number, month: number, weekday: number, nth: number): string => {
  const first = iso(year, month, 1)
  return addDays(first, ((weekday - weekdayIndex(first) + 7) % 7) + (nth - 1) * 7)
}

const lastWeekday = (year: number, month: number, weekday: number): string => {
  const last = addDays(iso(year, month + 1, 1), -1)
  return addDays(last, -((weekdayIndex(last) - weekday + 7) % 7))
}

const observed = (date: string): string => {
  if (weekdayIndex(date) === SATURDAY) return addDays(date, -1)
  if (weekdayIndex(date) === SUNDAY) return addDays(date, 1)
  return date
}

const easterSunday = (year: number): string => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const position = h + l - 7 * m + 114
  return iso(year, Math.floor(position / 31), (position % 31) + 1)
}

const newYear = (year: number): string[] => {
  const day = iso(year, 1, 1)
  return weekdayIndex(day) === SATURDAY ? [] : [observed(day)]
}

const juneteenth = (year: number): string[] => (year >= JUNETEENTH_SINCE ? [observed(iso(year, 6, 19))] : [])

const buildHolidays = (year: number): string[] => [
  ...newYear(year),
  nthWeekday(year, 1, MONDAY, 3),
  nthWeekday(year, 2, MONDAY, 3),
  addDays(easterSunday(year), -2),
  lastWeekday(year, 5, MONDAY),
  ...juneteenth(year),
  observed(iso(year, 7, 4)),
  nthWeekday(year, 9, MONDAY, 1),
  nthWeekday(year, 11, THURSDAY, 4),
  observed(iso(year, 12, 25)),
]

export const usMarketHolidays = (year: number): string[] => {
  const known = cache.get(year)
  if (known) return known
  const built = buildHolidays(year)
  cache.set(year, built)
  return built
}

const holidaysBetween = (from: string, to: string): string[] => {
  const years = Array.from({ length: Math.max(yearOf(to) - yearOf(from) + 1, 0) }, (_, index) => yearOf(from) + index)
  return years.flatMap(usMarketHolidays).filter((holiday) => holiday > from && holiday <= to)
}

export const usMarketDaysBetween = (from: string, to: string): number =>
  weekdaysBetween(from, to) - holidaysBetween(from, to).length

export const addUsMarketDays = (from: string, steps: number): string => {
  let landed = addWeekdays(from, steps)
  let skipped = holidaysBetween(from, landed).length
  let counted = 0
  while (skipped > counted) {
    counted = skipped
    landed = addWeekdays(from, steps + skipped)
    skipped = holidaysBetween(from, landed).length
  }
  return landed
}

export const followsUsMarket = (times: string[]): boolean => {
  const first = times[0]
  const last = times.at(-1)
  if (!first || !last) return false
  const horizon = addDays(last, -RECENT_DAYS)
  const recent = holidaysBetween(first > horizon ? first : horizon, last)
  const traded = new Set(times.slice(-RECENT_DAYS))
  return recent.length >= MIN_EVIDENCE && recent.every((holiday) => !traded.has(holiday))
}
