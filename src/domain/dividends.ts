import { mondayOf, monthStartOf } from '../../shared/dates'
import type { Bar, Dividend, Timeframe } from '../../shared/types'

const PERIOD: Record<Timeframe, (date: string) => string> = { D: (date) => date, W: mondayOf, M: monthStartOf }

const MIN_DIGITS = 2
const MAX_DIGITS = 4

export const dividendOfBar = (
  dividends: Dividend[],
  bars: Pick<Bar, 'time'>[],
  index: number,
  timeframe: Timeframe,
): Dividend | null => {
  const bar = bars[index]
  if (!bar) return null
  const period = PERIOD[timeframe](bar.time)
  return dividends.find((dividend) => PERIOD[timeframe](dividend.date) === period) ?? null
}

export const dividendLabel = (dividend: Dividend): string => {
  const amount = dividend.amount.toLocaleString('en-US', {
    minimumFractionDigits: MIN_DIGITS,
    maximumFractionDigits: MAX_DIGITS,
    useGrouping: false,
  })
  return `Dividend ${amount}`
}
