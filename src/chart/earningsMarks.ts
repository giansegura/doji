import type { Earnings } from '../../shared/types'
import type { TimeIndex } from './timeIndex'

export type EarningsMark = { x: number; kind: 'past' | 'next' }

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export const earningsMarks = (
  earnings: Earnings,
  timeIndex: TimeIndex,
  toX: (index: number) => number | null,
  width: number,
): EarningsMark[] => {
  const dated: { date: string; kind: EarningsMark['kind'] }[] = [
    ...earnings.past.map((date) => ({ date, kind: 'past' as const })),
    ...(earnings.next ? [{ date: earnings.next, kind: 'next' as const }] : []),
  ]
  return dated.flatMap(({ date, kind }) => {
    const x = toX(timeIndex.dateToIndex(date))
    return x !== null && x >= 0 && x <= width ? [{ x, kind }] : []
  })
}

export const nextEarningsLabel = (earnings: Earnings): string | null => {
  if (!earnings.next) return null
  const day = DAY_FORMAT.format(new Date(`${earnings.next}T00:00:00Z`))
  return `Earnings ${earnings.nextIsEstimate ? '~' : ''}${day}`
}
