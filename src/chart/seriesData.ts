import type { Bar, Timeframe } from '../../shared/types'
import { rsi, sma } from '../domain/rsi'
import { toWeekly } from '../domain/weekly'

export type ValuePoint = { time: string; value?: number }

export type SeriesData = {
  bars: Bar[]
  candles: { time: string; open: number; high: number; low: number; close: number }[]
  closes: { time: string; value: number }[]
  volume: { time: string; value: number; color: string }[]
  rsi: ValuePoint[]
  rsiMa: ValuePoint[]
  smas: ValuePoint[][]
}

export type HoverValues = {
  bar: Bar
  previousClose: number | null
  rsi: number | null
  rsiMa: number | null
  smas: (number | null)[]
}

export const RSI_MA_LENGTH = 14

export const hoverAt = (data: SeriesData, index: number): HoverValues | null => {
  const bar = index >= 0 ? data.bars[index] : undefined
  if (!bar) return null
  return {
    bar,
    previousClose: data.bars[index - 1]?.close ?? null,
    rsi: data.rsi[index]?.value ?? null,
    rsiMa: data.rsiMa[index]?.value ?? null,
    smas: data.smas.map((points) => points[index]?.value ?? null),
  }
}

const toPoints = (bars: Bar[], values: (number | null)[]): ValuePoint[] =>
  bars.map((bar, index) => {
    const value = values[index]
    return value === null ? { time: bar.time } : { time: bar.time, value }
  })

export const buildSeriesData = (
  daily: Bar[],
  timeframe: Timeframe,
  rsiLength: number,
  colors: { volumeUp: string; volumeDown: string },
  smaLengths: number[] = [],
): SeriesData => {
  const bars = timeframe === 'W' ? toWeekly(daily) : daily
  const closes = bars.map((bar) => bar.close)
  const rsiValues = rsi(closes, rsiLength)
  return {
    bars,
    candles: bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })),
    closes: bars.map((bar) => ({ time: bar.time, value: bar.close })),
    volume: bars.map((bar) => ({
      time: bar.time,
      value: bar.volume,
      color: bar.close >= bar.open ? colors.volumeUp : colors.volumeDown,
    })),
    rsi: toPoints(bars, rsiValues),
    rsiMa: toPoints(bars, sma(rsiValues, RSI_MA_LENGTH)),
    smas: smaLengths.map((length) => toPoints(bars, sma(closes, length))),
  }
}
