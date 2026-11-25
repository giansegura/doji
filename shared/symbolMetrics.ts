import { rsi, sma } from './rsi'
import { addDays } from './dates'
import { type Level, supportsAndResistances } from './levels'
import type { Bar } from './types'

export type NearestLevel = { price: number; kind: 'support' | 'resistance'; percent: number }

export type SymbolMetrics = {
  rsi: number | null
  fromHighPercent: number | null
  volumeRatio: number | null
  level: NearestLevel | null
}

const RSI_LENGTH = 14
const VOLUME_AVERAGE = 20
const YEAR_DAYS = 365
const DIGITS = 2

const round = (value: number): number => Number(value.toFixed(DIGITS))

export const fromYearHigh = (bars: Bar[]): number | null => {
  const last = bars.at(-1)
  if (!last) return null
  const since = addDays(last.time, -YEAR_DAYS)
  const high = Math.max(...bars.filter((bar) => bar.time >= since).map((bar) => bar.high))
  return high > 0 ? round(((last.close - high) / high) * 100) : null
}

const volumeRatio = (bars: Bar[]): number | null => {
  const average = sma(bars.map((bar) => bar.volume), VOLUME_AVERAGE).at(-1) ?? null
  return average ? round((bars.at(-1) as Bar).volume / average) : null
}

const nearestLevel = (symbol: string, bars: Bar[], close: number): NearestLevel | null => {
  const found = supportsAndResistances(symbol, bars, 1)
  const nearest = [found?.supports[0], found?.resistances[0]]
    .filter((level): level is Level => level !== undefined)
    .sort((a, b) => Math.abs(a.price - close) - Math.abs(b.price - close))[0]
  if (!nearest) return null
  return { price: nearest.price, kind: nearest.price > close ? 'resistance' : 'support', percent: round(((nearest.price - close) / close) * 100) }
}

export const symbolMetrics = (symbol: string, bars: Bar[], withLevel: boolean): SymbolMetrics => {
  const last = bars.at(-1)
  if (!last) return { rsi: null, fromHighPercent: null, volumeRatio: null, level: null }
  const strength = rsi(bars.map((bar) => bar.close), RSI_LENGTH).at(-1) ?? null
  return {
    rsi: strength === null ? null : round(strength),
    fromHighPercent: fromYearHigh(bars),
    volumeRatio: volumeRatio(bars),
    level: withLevel ? nearestLevel(symbol, bars, last.close) : null,
  }
}
