import { mondayOf, monthStartOf } from '../../shared/dates'
import type { Bar, Earnings, EarningsResult, Timeframe } from '../../shared/types'
import { formatPercent, formatSigned } from '../chart/format'

export type Report = EarningsResult & { date: string }

const PERIOD: Record<Timeframe, (date: string) => string> = { D: (date) => date, W: mondayOf, M: monthStartOf }

export const reportOfBar = (earnings: Earnings | null, bars: Pick<Bar, 'time'>[], index: number, timeframe: Timeframe): Report | null => {
  const bar = bars[index]
  if (!earnings || !bar) return null
  const period = PERIOD[timeframe](bar.time)
  const date = earnings.past.find((day) => PERIOD[timeframe](day) === period)
  const result = date ? earnings.results?.[date] : undefined
  return date && result ? { date, ...result } : null
}

const eps = (value: number): string => formatSigned(value).replace(/^\+/, '')

export const reportLabel = (report: Report): string => {
  if (report.estimate === null) return `EPS ${eps(report.actual)}`
  const surprise = report.estimate === 0 ? null : ((report.actual - report.estimate) / Math.abs(report.estimate)) * 100
  const tail = surprise === null ? '' : ` (${formatPercent(surprise)})`
  return `EPS ${eps(report.actual)} vs ${eps(report.estimate)} est.${tail}`
}
