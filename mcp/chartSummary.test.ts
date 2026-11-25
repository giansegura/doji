import { expect, test } from 'vitest'
import { addWeekdays } from '../shared/dates'
import type { Bar, Drawing, History, Quote } from '../shared/types'
import { symbolMetrics } from '../shared/symbolMetrics'
import { bollinger, macd } from '../src/domain/studies'
import { toWeekly } from '../src/domain/weekly'
import { type SummaryInput, scanRow, summarizeChart } from './chartSummary'

const START = '2025-01-02'

const DAYS = (() => {
  const days = [START]
  while (days.length < 2000) days.push(addWeekdays(days[days.length - 1], 1))
  return days
})()

const barsOf = (closes: number[]): Bar[] =>
  closes.map((close, index) => ({
    time: DAYS[index],
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000 + index,
  }))

const historyOf = (closes: number[], over: Partial<History> = {}): History => ({
  info: { symbol: 'KO', name: 'The Coca-Cola Company', exchange: 'NYSE' },
  bars: barsOf(closes),
  splits: [],
  fetchedAt: '2026-11-24T10:00:00.000Z',
  stale: false,
  ...over,
})

const rising = Array.from({ length: 300 }, (_, index) => 100 + index * 0.5)

const input = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  history: historyOf(rising),
  timeframe: 'D',
  bars: 5,
  averages: [],
  drawings: [],
  note: null,
  quote: null,
  ...over,
})

const lastDate = addWeekdays(START, 299)

test('Should describe the symbol, the timeframe and the last bar with its change against the previous close', () => {
  const summary = summarizeChart(input())
  expect(summary).toMatchObject({
    symbol: 'KO',
    name: 'The Coca-Cola Company',
    exchange: 'NYSE',
    timeframe: 'D',
    lastBar: lastDate,
    price: { close: 249.5, change: 0.5, changePercent: 0.2, extended: null },
  })
})

test('Should give the usual averages and the ones the user set, each with its distance from the close', () => {
  const summary = summarizeChart(input({ averages: [{ id: 'a', length: 50, color: '#000000', width: 1 }, { id: 'b', length: 10, color: '#000000', width: 1, kind: 'ema' }] }))
  expect(summary.averages.map((average) => average.name)).toEqual(['SMA 20', 'SMA 50', 'SMA 200', 'EMA 21', 'EMA 10'])
  expect(summary.averages[0]).toEqual({ name: 'SMA 20', value: 244.75, distancePercent: 1.94 })
})

test('Should give no value for an average that needs more bars than there are', () => {
  const summary = summarizeChart(input({ history: historyOf(rising.slice(0, 100)) }))
  expect(summary.averages.find((average) => average.name === 'SMA 200')).toEqual({
    name: 'SMA 200',
    value: null,
    distancePercent: null,
  })
})

test('Should give the RSI with its average, the MACD, the Bollinger Bands and the volume against its average', () => {
  const summary = summarizeChart(input())
  const lines = macd(rising, 12, 26, 9)
  const bands = bollinger(rising, 20, 2)
  expect(summary.rsi).toEqual({ length: 14, value: 100, average: 100 })
  expect(summary.macd).toEqual({
    line: Number((lines.macd.at(-1) as number).toFixed(3)),
    signal: Number((lines.signal.at(-1) as number).toFixed(3)),
    histogram: Number((lines.histogram.at(-1) as number).toFixed(3)),
    previousHistogram: Number((lines.histogram.at(-2) as number).toFixed(3)),
  })
  expect(summary.bollinger).toMatchObject({
    upper: Number((bands.upper.at(-1) as number).toFixed(2)),
    basis: 244.75,
    lower: Number((bands.lower.at(-1) as number).toFixed(2)),
    widthPercent: Number(((((bands.upper.at(-1) as number) - (bands.lower.at(-1) as number)) / 244.75) * 100).toFixed(2)),
  })
  expect(summary.volume).toEqual({ last: 1299, average20: 1290, ratio: 1.01 })
})

test('Should place the close within its range of the last 52 weeks, from the daily bars', () => {
  const closes = Array.from({ length: 300 }, (_, index) => (index < 20 ? 50 : 100 + ((index * 7) % 31)))
  const weekly = summarizeChart(input({ history: historyOf(closes), timeframe: 'W' }))
  const close = closes[299]
  expect(weekly.range52Weeks).toEqual({
    high: 132,
    low: 98,
    positionPercent: Number((((close - 98) / 34) * 100).toFixed(2)),
    fromHighPercent: Number((((close - 132) / 132) * 100).toFixed(2)),
  })
})

test('Should list the latest swing highs and lows', () => {
  const zigzag = Array.from({ length: 60 }, (_, index) => {
    const step = index % 10
    return 100 + (step < 5 ? step : 10 - step) * 3
  })
  const summary = summarizeChart(input({ history: historyOf(zigzag) }))
  expect(summary.swingHighs).toEqual([15, 25, 35, 45, 55].map((index) => ({ date: addWeekdays(START, index), price: 117 })))
  expect(summary.swingLows).toEqual([10, 20, 30, 40, 50].map((index) => ({ date: addWeekdays(START, index), price: 98 })))
})

test('Should include only the requested number of recent bars, oldest first', () => {
  const summary = summarizeChart(input({ bars: 2 }))
  expect(summary.recentBars).toEqual({
    columns: ['date', 'open', 'high', 'low', 'close', 'volume'],
    rows: [
      [addWeekdays(START, 298), 248, 251, 247, 249, 1298],
      [lastDate, 248.5, 251.5, 247.5, 249.5, 1299],
    ],
  })
})

test('Should summarize the weekly timeframe from the daily bars', () => {
  const weeks = toWeekly(barsOf(rising))
  const summary = summarizeChart(input({ timeframe: 'W', bars: 3 }))
  expect(summary.timeframe).toBe('W')
  expect(summary.lastBar).toBe(weeks.at(-1)?.time)
  expect(summary.recentBars.rows).toHaveLength(3)
  expect(summary.price.change).toBe(Number((rising[299] - (weeks.at(-2) as Bar).close).toFixed(2)))
})

test('Should round prices to cents, or to four decimals under one', () => {
  const summary = summarizeChart(input({ history: historyOf(Array.from({ length: 30 }, () => 0.123456)) }))
  expect(summary.price.close).toBe(0.1235)
})

test('Should describe the drawings and where a trend line on the price stands today', () => {
  const base = { pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 2, pricedAt: '2020-01-01' }
  const drawings: Drawing[] = [
    {
      ...base,
      id: 't',
      p1: { date: addWeekdays(lastDate, -10), value: 240 },
      p2: { date: addWeekdays(lastDate, -5), value: 245 },
      extendRight: true,
      alert: true,
    },
    { ...base, id: 'h', kind: 'hline', value: 230 },
    { ...base, id: 'r', kind: 'rect', pane: 'rsi', p1: { date: lastDate, value: 30 }, p2: { date: lastDate, value: 40 } },
  ]
  expect(summarizeChart(input({ drawings })).drawings).toEqual([
    {
      id: 't',
      kind: 'trend',
      pane: 'price',
      timeframe: 'D',
      from: { date: addWeekdays(lastDate, -10), level: 240 },
      to: { date: addWeekdays(lastDate, -5), level: 245 },
      extendRight: true,
      alert: true,
      levelToday: 250,
    },
    { id: 'h', kind: 'horizontal', pane: 'price', level: 230, alert: false },
    {
      id: 'r',
      kind: 'rectangle',
      pane: 'rsi',
      timeframe: 'D',
      from: { date: lastDate, level: 30 },
      to: { date: lastDate, level: 40 },
    },
  ])
})

test('Should add the price outside regular hours when the quote has one', () => {
  const quote: Quote = { symbol: 'KO', price: 249.5, change: 0, changePercent: 0, extended: { session: 'post', price: 251, changePercent: 0.601 } }
  expect(summarizeChart(input({ quote })).price.extended).toEqual({ session: 'post', price: 251, changePercent: 0.6 })
})

test('Should carry the note and say when the data could not be refreshed', () => {
  const summary = summarizeChart(input({ note: 'Comprar por debajo de 240', history: historyOf(rising, { stale: true }) }))
  expect(summary.note).toBe('Comprar por debajo de 240')
  expect(summary.data).toEqual({ fetchedAt: '2026-11-24T10:00:00.000Z', stale: true, source: 'Yahoo Finance, may be delayed' })
})

const ranging = Array.from({ length: 900 }, (_, index) => {
  const phase = (index % 100) / 100
  return 100 + 20 * (phase < 0.5 ? phase * 2 : (1 - phase) * 2)
})

test('Should give the last four dividends and the yield of the last twelve months', () => {
  const dividends = [
    { date: '2025-01-10', amount: 0.5 },
    { date: '2025-03-14', amount: 0.5 },
    { date: '2025-06-13', amount: 0.5 },
    { date: '2025-09-12', amount: 0.5 },
    { date: '2025-12-12', amount: 0.55 },
  ]
  const summary = summarizeChart(input({ history: historyOf(rising, { dividends }) }))
  expect(summary.dividends.recent).toEqual(dividends.slice(1))
  expect(summary.dividends.yieldPercent).toBeCloseTo((2.05 / 249.5) * 100, 2)
  expect(summarizeChart(input()).dividends).toEqual({ recent: [], yieldPercent: null })
})

test('Should give the support and resistance levels around the close with their distance', () => {
  const summary = summarizeChart(input({ history: historyOf([...ranging, 109, 110]) }))
  expect(summary.levels.supports.length).toBeGreaterThan(0)
  expect(summary.levels.resistances.length).toBeGreaterThan(0)
  summary.levels.supports.forEach((level) => {
    expect(level.price).toBeLessThanOrEqual(110)
    expect(level.distancePercent).toBeCloseTo(((level.price - 110) / 110) * 100, 1)
  })
  expect(summary.levels.resistances.every((level) => level.price > 110 && level.touches >= 1)).toBe(true)
})

test('Should give the distance to the nearest support and resistance in a scan row', () => {
  const summary = summarizeChart(input({ history: historyOf([...ranging, 109, 110]) }))
  const row = scanRow(summary)
  expect(row.nearestSupportPercent).toBe(summary.levels.supports[0].distancePercent)
  expect(row.nearestResistancePercent).toBe(summary.levels.resistances[0].distancePercent)
  expect(scanRow(summarizeChart(input({ history: historyOf([100, 101]) }))).nearestSupportPercent).toBeNull()
})

const risingBars = () => historyOf(rising).bars

test('Should reduce a chart to one row of its main readings', () => {
  const quote: Quote = { symbol: 'KO', price: 249.5, change: 0.5, changePercent: 0.2, extended: { session: 'pre', price: 250, changePercent: 0.2 } }
  const summary = summarizeChart(input({ quote, note: 'Tesis', drawings: [{ id: 'h', kind: 'hline', pane: 'price', timeframe: 'D', value: 230, color: '#2962FF', width: 2, pricedAt: '2020-01-01', alert: true }] }))
  expect(scanRow(summary)).toEqual({
    symbol: 'KO',
    close: 249.5,
    changePercent: 0.2,
    extendedChangePercent: 0.2,
    rsi: 100,
    vsSma50Percent: summary.averages[1].distancePercent,
    vsSma200Percent: summary.averages[2].distancePercent,
    range52WeeksPercent: summary.range52Weeks.positionPercent,
    fromHigh52Percent: symbolMetrics('KO', risingBars(), false).fromHighPercent,
    macdHistogram: summary.macd.histogram,
    volumeRatio: 1.01,
    alerts: 1,
    hasNote: true,
    nearestSupportPercent: summary.levels.supports[0]?.distancePercent ?? null,
    nearestResistancePercent: summary.levels.resistances[0]?.distancePercent ?? null,
  })
})

test('Should give forex prices with four decimals, or three for pairs above twenty', () => {
  const euro = summarizeChart(input({ history: historyOf(Array.from({ length: 30 }, () => 1.096731), { info: { symbol: 'EURUSD=X', name: 'EUR/USD', exchange: 'Forex' } }) }))
  expect(euro.price.close).toBe(1.0967)
  const yen = summarizeChart(input({ history: historyOf(Array.from({ length: 30 }, () => 159.12938), { info: { symbol: 'JPY=X', name: 'USD/JPY', exchange: 'Forex' } }) }))
  expect(yen.price.close).toBe(159.129)
})

test('Should describe the drawings at the prices after the latest split', () => {
  const split = { date: addWeekdays(START, 100), numerator: 2, denominator: 1 }
  const level: Drawing = { id: 'h', kind: 'hline', pane: 'price', timeframe: 'D', value: 100, color: '#2962FF', width: 2, pricedAt: '2020-01-01' }
  const summary = summarizeChart(input({ history: historyOf(rising, { splits: [split] }), drawings: [level] }))
  expect(summary.drawings).toEqual([{ id: 'h', kind: 'horizontal', pane: 'price', level: 50, alert: false }])
})

test('Should describe a position with its entry, stop, target, reward to risk and its sizing', () => {
  const base = { pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 1, pricedAt: '2020-01-01' }
  const drawings: Drawing[] = [
    {
      ...base,
      id: 'p',
      kind: 'position',
      side: 'long',
      p1: { date: addWeekdays(lastDate, -5), value: 240 },
      p2: { date: lastDate, value: 240 },
      stop: 230,
      target: 270,
      alert: true,
      account: 10000,
      riskPercent: 1,
    },
  ]
  expect(summarizeChart(input({ drawings })).drawings).toEqual([
    {
      id: 'p',
      kind: 'position',
      side: 'long',
      from: addWeekdays(lastDate, -5),
      to: lastDate,
      entry: 240,
      stop: 230,
      target: 270,
      rewardToRisk: 3,
      alert: true,
      shares: 10,
    },
  ])
})

test('Should say which drawings the AI made and which were drawn in euros', () => {
  const base = { pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 2, pricedAt: '2020-01-01' }
  const drawings: Drawing[] = [
    { ...base, id: 'mine', kind: 'hline', value: 230, by: 'ai' },
    { ...base, id: 'yours', kind: 'hline', value: 231 },
    { ...base, id: 'euros', kind: 'hline', value: 210, currency: 'EUR' },
  ]
  expect(summarizeChart(input({ drawings })).drawings).toEqual([
    { id: 'mine', kind: 'horizontal', pane: 'price', level: 230, alert: false, madeByAi: true },
    { id: 'yours', kind: 'horizontal', pane: 'price', level: 231, alert: false },
    { id: 'euros', kind: 'horizontal', pane: 'price', level: 210, alert: false, currency: 'EUR' },
  ])
})
