const DAY_MS = 86_400_000
const REFERENCE_MONDAY_MS = Date.parse('1970-01-05T00:00:00Z')

const toMs = (date: string): number => Date.parse(`${date}T00:00:00Z`)

const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

const daysSinceReference = (date: string): number => Math.round((toMs(date) - REFERENCE_MONDAY_MS) / DAY_MS)

const positiveModulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor

export const weekdayIndex = (date: string): number => positiveModulo(daysSinceReference(date), 7)

const isWeekend = (date: string): boolean => weekdayIndex(date) >= 5

const weekdaysUpTo = (date: string): number => {
  const days = daysSinceReference(date)
  const weeks = Math.floor(days / 7)
  return weeks * 5 + Math.min(positiveModulo(days, 7) + 1, 5)
}

export const addDays = (date: string, n: number): string => toIso(toMs(date) + n * DAY_MS)

export const mondayOf = (date: string): string => addDays(date, -weekdayIndex(date))

export const addWeekdays = (date: string, n: number): string => {
  const step = n < 0 ? -1 : 1
  let current = date
  let remaining = Math.abs(n)
  while (remaining > 0) {
    current = addDays(current, step)
    if (!isWeekend(current)) remaining -= 1
  }
  return current
}

export const weekdaysBetween = (from: string, to: string): number => weekdaysUpTo(to) - weekdaysUpTo(from)

export const weeksBetween = (from: string, to: string): number =>
  Math.round((toMs(mondayOf(to)) - toMs(mondayOf(from))) / (7 * DAY_MS))

export const todayIso = (): string => {
  const now = new Date()
  return toIso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}
