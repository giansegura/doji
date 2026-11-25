import type { Dividend, Earnings } from '../../shared/types'
import type { TimeIndex } from './timeIndex'

export type EarningsMark = { x: number; kind: 'past' | 'next' | 'dividend'; row?: number; tone?: 'beat' | 'miss' }

const SHARED_BAR_PX = 14

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
    if (x === null || x < 0 || x > width) return []
    const result = kind === 'past' ? earnings.results?.[date] : undefined
    const tone = result && result.estimate !== null ? (result.actual >= result.estimate ? 'beat' : 'miss') : null
    return [tone ? { x, kind, tone } : { x, kind }]
  })
}

export const dividendMarks = (
  dividends: Dividend[],
  timeIndex: TimeIndex,
  toX: (index: number) => number | null,
  width: number,
  below: EarningsMark[],
): EarningsMark[] =>
  dividends.flatMap(({ date }) => {
    const x = toX(timeIndex.dateToIndex(date))
    if (x === null || x < 0 || x > width) return []
    const stacked = below.some((mark) => Math.abs(mark.x - x) < SHARED_BAR_PX)
    return [{ x, kind: 'dividend' as const, row: stacked ? 1 : 0 }]
  })

export const nextEarningsLabel = (earnings: Earnings): string | null => {
  if (!earnings.next) return null
  const day = DAY_FORMAT.format(new Date(`${earnings.next}T00:00:00Z`))
  const estimate = earnings.nextEstimate === undefined ? '' : ` · EPS est. ${earnings.nextEstimate.toFixed(2)}`
  return `Earnings ${earnings.nextIsEstimate ? '~' : ''}${day}${estimate}`
}
