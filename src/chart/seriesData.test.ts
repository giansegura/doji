import { expect, test } from 'vitest'
import type { Bar } from '../../shared/types'
import { addWeekdays } from '../../shared/dates'
import { buildSeriesData, hoverAt } from './seriesData'

const colors = { volumeUp: 'up', volumeDown: 'down' }

const bar = (time: string, open: number, high: number, low: number, close: number, volume: number): Bar => ({
  time,
  open,
  high,
  low,
  close,
  volume,
})

test('Should colour volume by candle direction', () => {
  const daily = [bar('2026-11-18', 10, 12, 9, 11, 100), bar('2026-11-19', 11, 11, 8, 9, 200), bar('2026-11-20', 9, 9, 9, 9, 50)]
  expect(buildSeriesData(daily, 'D', 14, colors).volume).toEqual([
    { time: '2026-11-18', value: 100, color: 'up' },
    { time: '2026-11-19', value: 200, color: 'down' },
    { time: '2026-11-20', value: 50, color: 'up' },
  ])
})

test('Should pass candles through without the volume', () => {
  const out = buildSeriesData([bar('2026-11-20', 10, 12, 9, 11, 100)], 'D', 14, colors)
  expect(out.candles).toEqual([{ time: '2026-11-20', open: 10, high: 12, low: 9, close: 11 }])
  expect(out.bars).toEqual([bar('2026-11-20', 10, 12, 9, 11, 100)])
})

test('Should offer the closes as a line for chart types that draw one value per bar', () => {
  const daily = [bar('2026-11-19', 10, 12, 9, 11, 100), bar('2026-11-20', 11, 15, 10, 14, 200)]
  expect(buildSeriesData(daily, 'D', 14, colors).closes).toEqual([
    { time: '2026-11-19', value: 11 },
    { time: '2026-11-20', value: 14 },
  ])
})

test('Should keep one RSI entry per bar and leave the warm-up without value', () => {
  const daily = Array.from({ length: 20 }, (_, i) => bar(addWeekdays('2026-10-01', i), 10 + i, 11 + i, 9 + i, 10 + i, 1))
  const out = buildSeriesData(daily, 'D', 14, colors)
  expect(out.rsi).toHaveLength(20)
  expect(out.rsi[13]).toEqual({ time: daily[13].time })
  expect(out.rsi[14]).toEqual({ time: daily[14].time, value: 100 })
  expect(out.rsiMa).toHaveLength(20)
  expect(out.rsiMa[19]).toEqual({ time: daily[19].time })
})

test('Should average the RSI once fourteen values exist', () => {
  const daily = Array.from({ length: 30 }, (_, i) => bar(addWeekdays('2026-10-01', i), 10 + i, 11 + i, 9 + i, 10 + i, 1))
  const out = buildSeriesData(daily, 'D', 14, colors)
  expect(out.rsiMa[26]).toEqual({ time: daily[26].time })
  expect(out.rsiMa[27]).toEqual({ time: daily[27].time, value: 100 })
})

test('Should build weekly series from daily bars', () => {
  const daily = Array.from({ length: 10 }, (_, i) => bar(addWeekdays('2026-11-09', i), 10, 11, 9, 10, 1))
  const out = buildSeriesData(daily, 'W', 14, colors)
  expect(out.candles.map((candle) => candle.time)).toEqual(['2026-11-09', '2026-11-16'])
  expect(out.volume.map((item) => item.value)).toEqual([5, 5])
})

test('Should use the given RSI length', () => {
  const daily = Array.from({ length: 6 }, (_, i) => bar(addWeekdays('2026-11-09', i), 10 + i, 11 + i, 9 + i, 10 + i, 1))
  const out = buildSeriesData(daily, 'D', 3, colors)
  expect(out.rsi.map((item) => item.value)).toEqual([undefined, undefined, undefined, 100, 100, 100])
})

test('Should not fail with fewer bars than the RSI length', () => {
  const out = buildSeriesData([bar('2026-11-20', 1, 2, 1, 2, 5)], 'D', 14, colors)
  expect(out.candles).toHaveLength(1)
  expect(out.rsi).toEqual([{ time: '2026-11-20' }])
  expect(out.rsiMa).toEqual([{ time: '2026-11-20' }])
})

test('Should read the values under the cursor', () => {
  const daily = Array.from({ length: 30 }, (_, i) => bar(addWeekdays('2026-10-01', i), 10 + i, 11 + i, 9 + i, 10 + i, 7))
  const out = buildSeriesData(daily, 'D', 14, colors)
  expect(hoverAt(out, 28)).toEqual({ bar: daily[28], previousClose: 37, rsi: 100, rsiMa: 100, smas: [] })
  expect(hoverAt(out, 0)).toEqual({ bar: daily[0], previousClose: null, rsi: null, rsiMa: null, smas: [] })
})

test('Should read nothing outside the bars', () => {
  const out = buildSeriesData([bar('2026-11-20', 1, 2, 1, 2, 5)], 'D', 14, colors)
  expect(hoverAt(out, 1)).toBe(null)
  expect(hoverAt(out, -1)).toBe(null)
  expect(hoverAt(buildSeriesData([], 'D', 14, colors), 0)).toBe(null)
})

test('Should build one moving average per requested length', () => {
  const daily = [10, 20, 30, 40].map((close, i) => bar(addWeekdays('2026-11-09', i), close, close, close, close, 1))
  const out = buildSeriesData(daily, 'D', 14, colors, [2, 3])
  expect(out.smas).toHaveLength(2)
  expect(out.smas[0].map((item) => item.value)).toEqual([undefined, 15, 25, 35])
  expect(out.smas[1].map((item) => item.value)).toEqual([undefined, undefined, 20, 30])
  expect(out.smas[1].map((item) => item.time)).toEqual(daily.map((item) => item.time))
})

test('Should average weekly closes on the weekly timeframe', () => {
  const daily = Array.from({ length: 15 }, (_, i) => bar(addWeekdays('2026-11-09', i), i, i, i, i, 1))
  const out = buildSeriesData(daily, 'W', 14, colors, [2])
  expect(out.smas[0].map((item) => item.value)).toEqual([undefined, 6.5, 11.5])
})

test('Should build no moving averages unless asked', () => {
  expect(buildSeriesData([bar('2026-11-20', 1, 2, 1, 2, 5)], 'D', 14, colors).smas).toEqual([])
})

test('Should read the moving averages under the cursor', () => {
  const daily = [10, 20, 30, 40].map((close, i) => bar(addWeekdays('2026-11-09', i), close, close, close, close, 1))
  const out = buildSeriesData(daily, 'D', 14, colors, [2, 3])
  expect(hoverAt(out, 1)?.smas).toEqual([15, null])
  expect(hoverAt(out, 3)?.smas).toEqual([35, 30])
})

test('Should return empty series for no bars', () => {
  const out = buildSeriesData([], 'D', 14, colors)
  expect([out.bars, out.candles, out.volume, out.rsi, out.rsiMa]).toEqual([[], [], [], [], []])
})
