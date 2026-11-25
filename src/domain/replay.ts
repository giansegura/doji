import { mondayOf, monthStartOf } from '../../shared/dates'
import type { Bar, Earnings, Timeframe } from '../../shared/types'

const PERIOD: Record<Timeframe, (date: string) => string> = { D: (date) => date, W: mondayOf, M: monthStartOf }

const endOfPeriod = (bars: Bar[], timeframe: Timeframe, date: string): string | null => {
  const period = PERIOD[timeframe](date)
  const inPeriod = bars.filter((bar) => PERIOD[timeframe](bar.time) === period)
  return inPeriod.at(-1)?.time ?? null
}

export const replayBars = (bars: Bar[], cutoff: string): Bar[] => bars.filter((bar) => bar.time <= cutoff)

export const startOfReplay = (bars: Bar[], timeframe: Timeframe, picked: string): string | null => {
  const end = endOfPeriod(bars, timeframe, picked)
  const last = bars.at(-1)?.time
  return end && last && end < last ? end : null
}

export const stepReplay = (bars: Bar[], timeframe: Timeframe, cutoff: string): string | null => {
  const next = bars.find((bar) => bar.time > cutoff)
  return next ? endOfPeriod(bars, timeframe, next.time) : null
}

export const earningsAsOf = (earnings: Earnings, cutoff: string | null): Earnings =>
  cutoff === null ? earnings : { ...earnings, past: earnings.past.filter((date) => date <= cutoff), next: null }

export type ReplayState =
  | { status: 'off' }
  | { status: 'picking' }
  | { status: 'on'; cutoff: string; playing: boolean; speed: number }
