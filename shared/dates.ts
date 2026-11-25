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

export const daysBetween = (from: string, to: string): number => Math.round((toMs(to) - toMs(from)) / DAY_MS)

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

const monthNumber = (date: string): number => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1

export const monthStartOf = (date: string): string => `${date.slice(0, 7)}-01`

export const monthsBetween = (from: string, to: string): number => monthNumber(to) - monthNumber(from)

export const addMonths = (date: string, n: number): string => {
  const month = monthNumber(date) + n
  const year = String(Math.floor(month / 12)).padStart(4, '0')
  return `${year}-${String((month % 12) + 1).padStart(2, '0')}-01`
}

export const todayIso = (): string => {
  const now = new Date()
  return toIso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>()

const formatterIn = (timeZone: string): Intl.DateTimeFormat => {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' } as const
  try {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone })
  } catch {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' })
  }
}

export const dayInZone = (timeZone: string, ms: number): string => {
  const formatter = zoneFormatters.get(timeZone) ?? formatterIn(timeZone)
  zoneFormatters.set(timeZone, formatter)
  return formatter.format(new Date(ms))
}
