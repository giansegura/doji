import type { Bar, Timeframe } from '../../shared/types'
import { toMonthly } from '../domain/monthly'
import { ema, rsi, sma } from '../../shared/rsi'
import { bollinger, macd } from '../domain/studies'
import { toWeekly } from '../domain/weekly'

export type ValuePoint = { time: string; value?: number }

export type ColoredPoint = ValuePoint & { color?: string }

export type AverageSpec = { length: number; kind?: 'ema' }

export type Studies = {
  volumeMa?: number
  bollinger?: { length: number; multiplier: number }
  macd?: { fast: number; slow: number; signal: number }
}

export type BandsData = { basis: ValuePoint[]; upper: ValuePoint[]; lower: ValuePoint[] }

export type MacdData = { line: ValuePoint[]; signal: ValuePoint[]; histogram: ColoredPoint[] }

export type SeriesData = {
  bars: Bar[]
  candles: { time: string; open: number; high: number; low: number; close: number }[]
  closes: { time: string; value: number }[]
  volume: { time: string; value: number; color: string }[]
  volumeMa: ValuePoint[]
  rsi: ValuePoint[]
  rsiMa: ValuePoint[]
  smas: ValuePoint[][]
  bands: BandsData | null
  macd: MacdData | null
}

export type HoverValues = {
  bar: Bar
  previousClose: number | null
  volumeMa: number | null
  rsi: number | null
  rsiMa: number | null
  smas: (number | null)[]
  bands: { basis: number | null; upper: number | null; lower: number | null } | null
  macd: { line: number | null; signal: number | null; histogram: number | null } | null
}

type SeriesColors = { volumeUp: string; volumeDown: string; up?: string; down?: string }

export const RSI_MA_LENGTH = 14

const AGGREGATE: Record<Timeframe, (daily: Bar[]) => Bar[]> = { D: (daily) => daily, W: toWeekly, M: toMonthly }

const valueAt = (points: ValuePoint[], index: number): number | null => points[index]?.value ?? null

export const hoverAt = (data: SeriesData, index: number): HoverValues | null => {
  const bar = index >= 0 ? data.bars[index] : undefined
  if (!bar) return null
  return {
    bar,
    previousClose: data.bars[index - 1]?.close ?? null,
    volumeMa: valueAt(data.volumeMa, index),
    rsi: valueAt(data.rsi, index),
    rsiMa: valueAt(data.rsiMa, index),
    smas: data.smas.map((points) => valueAt(points, index)),
    bands: data.bands && {
      basis: valueAt(data.bands.basis, index),
      upper: valueAt(data.bands.upper, index),
      lower: valueAt(data.bands.lower, index),
    },
    macd: data.macd && {
      line: valueAt(data.macd.line, index),
      signal: valueAt(data.macd.signal, index),
      histogram: valueAt(data.macd.histogram, index),
    },
  }
}

const toPoints = (bars: Bar[], values: (number | null)[]): ValuePoint[] =>
  bars.map((bar, index) => {
    const value = values[index]
    return value === null ? { time: bar.time } : { time: bar.time, value }
  })

const toBands = (bars: Bar[], closes: number[], study: Studies['bollinger']): BandsData | null => {
  if (!study) return null
  const bands = bollinger(closes, study.length, study.multiplier)
  return { basis: toPoints(bars, bands.basis), upper: toPoints(bars, bands.upper), lower: toPoints(bars, bands.lower) }
}

const toMacd = (bars: Bar[], closes: number[], study: Studies['macd'], colors: SeriesColors): MacdData | null => {
  if (!study) return null
  const values = macd(closes, study.fast, study.slow, study.signal)
  const rising = colors.up ?? colors.volumeUp
  const falling = colors.down ?? colors.volumeDown
  return {
    line: toPoints(bars, values.macd),
    signal: toPoints(bars, values.signal),
    histogram: toPoints(bars, values.histogram).map((point) =>
      point.value === undefined ? point : { ...point, color: point.value < 0 ? falling : rising },
    ),
  }
}

export const buildSeriesData = (
  daily: Bar[],
  timeframe: Timeframe,
  rsiLength: number,
  colors: SeriesColors,
  averages: AverageSpec[] = [],
  studies: Studies = {},
): SeriesData => {
  const bars = AGGREGATE[timeframe](daily)
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
    volumeMa: studies.volumeMa
      ? toPoints(
          bars,
          sma(
            bars.map((bar) => bar.volume),
            studies.volumeMa,
          ),
        )
      : [],
    rsi: toPoints(bars, rsiValues),
    rsiMa: toPoints(bars, sma(rsiValues, RSI_MA_LENGTH)),
    smas: averages.map(({ length, kind }) => toPoints(bars, kind === 'ema' ? ema(closes, length) : sma(closes, length))),
    bands: toBands(bars, closes, studies.bollinger),
    macd: toMacd(bars, closes, studies.macd, colors),
  }
}
