import { addDays } from '../shared/dates'
import { type Level, supportsAndResistances } from '../shared/levels'
import { priceDigits } from '../shared/symbols'
import type { Bar, Drawing, History, LinePoint, Quote, SmaConfig, Timeframe } from '../shared/types'
import { alertLevel } from '../src/domain/alerts'
import { toMonthly } from '../src/domain/monthly'
import { rsi, sma } from '../src/domain/rsi'
import { adjustLinesForSplits } from '../src/domain/splits'
import { bollinger, ema, macd } from '../src/domain/studies'
import { toWeekly } from '../src/domain/weekly'

export type SummaryInput = {
  history: History
  timeframe: Timeframe
  bars: number
  averages: SmaConfig[]
  drawings: Drawing[]
  note: string | null
  quote: Quote | null
}

type Average = { length: number; kind?: 'ema' }

const USUAL_AVERAGES: Average[] = [{ length: 20 }, { length: 50 }, { length: 200 }, { length: 21, kind: 'ema' }]
const RSI_LENGTH = 14
const RSI_AVERAGE = 14
const MACD = { fast: 12, slow: 26, signal: 9 }
const BANDS = { length: 20, multiplier: 2 }
const VOLUME_AVERAGE = 20
const SWING_REACH = 3
const SWINGS_SHOWN = 5
const LEVELS_PER_SIDE = 3
const YEAR_DAYS = 365
const PERCENT_DIGITS = 2
const SOURCE = 'Yahoo Finance, may be delayed'
const COLUMNS = ['date', 'open', 'high', 'low', 'close', 'volume']

const AGGREGATE: Record<Timeframe, (daily: Bar[]) => Bar[]> = { D: (daily) => daily, W: toWeekly, M: toMonthly }

const roundTo = (value: number | null | undefined, digits: number): number | null =>
  value === null || value === undefined || !Number.isFinite(value) ? null : Number(value.toFixed(digits))

const percentFrom = (value: number | null, reference: number | null): number | null =>
  value === null || reference === null || reference === 0 ? null : ((value - reference) / reference) * 100

const lastOf = (values: (number | null)[], back = 1): number | null => values.at(-back) ?? null

const nameOf = (average: Average): string => `${average.kind === 'ema' ? 'EMA' : 'SMA'} ${average.length}`

const averagesFor = (user: SmaConfig[]): Average[] => {
  const all = [...USUAL_AVERAGES, ...user.map(({ length, kind }) => (kind === 'ema' ? { length, kind } : { length }))]
  return all.filter((average, index) => all.findIndex((other) => nameOf(other) === nameOf(average)) === index)
}

const isSwing = (values: number[], index: number, above: boolean): boolean => {
  const value = values[index]
  const left = values.slice(index - SWING_REACH, index)
  const right = values.slice(index + 1, index + 1 + SWING_REACH)
  if (above) return left.every((other) => value > other) && right.every((other) => value >= other)
  return left.every((other) => value < other) && right.every((other) => value <= other)
}

const swingsOf = (bars: Bar[], above: boolean, digits: number) => {
  const values = bars.map((bar) => (above ? bar.high : bar.low))
  return bars
    .flatMap((bar, index) =>
      index >= SWING_REACH && index + SWING_REACH < bars.length && isSwing(values, index, above)
        ? [{ date: bar.time, price: roundTo(values[index], digits) }]
        : [],
    )
    .slice(-SWINGS_SHOWN)
}

const yearRange = (daily: Bar[], close: number, digits: number) => {
  const since = addDays((daily.at(-1) as Bar).time, -YEAR_DAYS)
  const year = daily.filter((bar) => bar.time >= since)
  const high = Math.max(...year.map((bar) => bar.high))
  const low = Math.min(...year.map((bar) => bar.low))
  return {
    high: roundTo(high, digits),
    low: roundTo(low, digits),
    positionPercent: high === low ? null : roundTo(((close - low) / (high - low)) * 100, PERCENT_DIGITS),
  }
}

const pointOf = (point: LinePoint, digits: number) => ({ date: point.date, level: roundTo(point.value, digits) })

const describeDrawing = (drawing: Drawing, today: string, priceDigits: number) => {
  const digits = drawing.pane === 'price' ? priceDigits : PERCENT_DIGITS
  const { id, pane, timeframe } = drawing
  if (drawing.kind === 'hline') return { id, kind: 'horizontal', pane, level: roundTo(drawing.value, digits), alert: drawing.alert === true }
  const ends = { from: pointOf(drawing.p1, digits), to: pointOf(drawing.p2, digits) }
  if (drawing.kind === 'channel') return { id, kind: 'channel', pane, timeframe, ...ends, offset: roundTo(drawing.offset, digits) }
  if (drawing.kind === 'rect') return { id, kind: 'rectangle', pane, timeframe, ...ends }
  return {
    id,
    kind: 'trend',
    pane,
    timeframe,
    ...ends,
    extendRight: drawing.extendRight,
    alert: drawing.alert === true,
    levelToday: pane === 'price' ? roundTo(alertLevel(drawing, today), digits) : null,
  }
}

export const summarizeChart = ({ history, timeframe, bars: count, averages, drawings, note, quote }: SummaryInput) => {
  const daily = history.bars
  const last = daily.at(-1)
  if (!last) throw new Error(`No price data for ${history.info.symbol}`)
  const bars = AGGREGATE[timeframe](daily)
  const closes = bars.map((bar) => bar.close)
  const close = last.close
  const digits = priceDigits(history.info.symbol, close)
  const previous = bars.at(-2)?.close ?? null
  const rsiValues = rsi(closes, RSI_LENGTH)
  const lines = macd(closes, MACD.fast, MACD.slow, MACD.signal)
  const bands = bollinger(closes, BANDS.length, BANDS.multiplier)
  const upper = lastOf(bands.upper)
  const lower = lastOf(bands.lower)
  const basis = lastOf(bands.basis)
  const volumeAverage = lastOf(sma(bars.map((bar) => bar.volume), VOLUME_AVERAGE))
  const lastVolume = (bars.at(-1) as Bar).volume
  const extended = quote?.extended ?? null
  const found = supportsAndResistances(history.info.symbol, daily, LEVELS_PER_SIDE)
  const describeLevel = (level: Level) => ({
    price: level.price,
    touches: level.touches,
    allTimeHigh: level.ath,
    distancePercent: roundTo(level.distance * 100, PERCENT_DIGITS),
  })
  return {
    symbol: history.info.symbol,
    name: history.info.name,
    exchange: history.info.exchange,
    timeframe,
    lastBar: (bars.at(-1) as Bar).time,
    data: { fetchedAt: history.fetchedAt, stale: history.stale, source: SOURCE },
    price: {
      close: roundTo(close, digits),
      change: previous === null ? null : roundTo(close - previous, digits),
      changePercent: roundTo(percentFrom(close, previous), PERCENT_DIGITS),
      extended: extended && {
        session: extended.session,
        price: roundTo(extended.price, digits),
        changePercent: roundTo(extended.changePercent, PERCENT_DIGITS),
      },
    },
    range52Weeks: yearRange(daily, close, digits),
    averages: averagesFor(averages).map((average) => {
      const value = lastOf(average.kind === 'ema' ? ema(closes, average.length) : sma(closes, average.length))
      return {
        name: nameOf(average),
        value: roundTo(value, digits),
        distancePercent: roundTo(percentFrom(close, value), PERCENT_DIGITS),
      }
    }),
    rsi: {
      length: RSI_LENGTH,
      value: roundTo(lastOf(rsiValues), PERCENT_DIGITS),
      average: roundTo(lastOf(sma(rsiValues, RSI_AVERAGE)), PERCENT_DIGITS),
    },
    macd: {
      line: roundTo(lastOf(lines.macd), digits + 1),
      signal: roundTo(lastOf(lines.signal), digits + 1),
      histogram: roundTo(lastOf(lines.histogram), digits + 1),
      previousHistogram: roundTo(lastOf(lines.histogram, 2), digits + 1),
    },
    bollinger: {
      upper: roundTo(upper, digits),
      basis: roundTo(basis, digits),
      lower: roundTo(lower, digits),
      positionPercent:
        upper === null || lower === null || upper === lower ? null : roundTo(((close - lower) / (upper - lower)) * 100, PERCENT_DIGITS),
      widthPercent: upper === null || lower === null || !basis ? null : roundTo(((upper - lower) / basis) * 100, PERCENT_DIGITS),
    },
    volume: {
      last: lastVolume,
      average20: volumeAverage === null ? null : Math.round(volumeAverage),
      ratio: volumeAverage ? roundTo(lastVolume / volumeAverage, PERCENT_DIGITS) : null,
    },
    levels: {
      resistances: (found?.resistances ?? []).map(describeLevel),
      supports: (found?.supports ?? []).map(describeLevel),
    },
    swingHighs: swingsOf(bars, true, digits),
    swingLows: swingsOf(bars, false, digits),
    recentBars: {
      columns: COLUMNS,
      rows: (count > 0 ? bars.slice(-count) : []).map((bar) => [
        bar.time,
        roundTo(bar.open, digits),
        roundTo(bar.high, digits),
        roundTo(bar.low, digits),
        roundTo(bar.close, digits),
        bar.volume,
      ]),
    },
    drawings: adjustLinesForSplits(drawings, history.splits).lines.map((drawing) => describeDrawing(drawing, last.time, digits)),
    note,
  }
}

export type ChartSummary = ReturnType<typeof summarizeChart>

const distanceTo = (summary: ChartSummary, name: string): number | null =>
  summary.averages.find((average) => average.name === name)?.distancePercent ?? null

export const scanRow = (summary: ChartSummary) => ({
  symbol: summary.symbol,
  close: summary.price.close,
  changePercent: summary.price.changePercent,
  extendedChangePercent: summary.price.extended?.changePercent ?? null,
  rsi: summary.rsi.value,
  vsSma50Percent: distanceTo(summary, 'SMA 50'),
  vsSma200Percent: distanceTo(summary, 'SMA 200'),
  range52WeeksPercent: summary.range52Weeks.positionPercent,
  macdHistogram: summary.macd.histogram,
  volumeRatio: summary.volume.ratio,
  alerts: summary.drawings.filter((drawing) => 'alert' in drawing && drawing.alert).length,
  hasNote: summary.note !== null && summary.note.length > 0,
  nearestSupportPercent: summary.levels.supports[0]?.distancePercent ?? null,
  nearestResistancePercent: summary.levels.resistances[0]?.distancePercent ?? null,
})
