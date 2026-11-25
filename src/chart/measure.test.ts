import { expect, test } from 'vitest'
import { measureLines, readMeasure } from './measure'

test('Should read the change, the percent, the bars and the calendar days between two points', () => {
  expect(readMeasure({ date: '2026-10-01', value: 200 }, { date: '2026-11-02', value: 230 }, 22)).toEqual({
    change: 30,
    percent: 15,
    bars: 22,
    days: 32,
  })
})

test('Should read a fall from right to left as a negative change and a positive count', () => {
  expect(readMeasure({ date: '2026-11-02', value: 250 }, { date: '2026-10-01', value: 200 }, -22)).toEqual({
    change: -50,
    percent: -20,
    bars: 22,
    days: 32,
  })
})

test('Should write the reading in two lines with the decimals of the symbol', () => {
  expect(measureLines({ change: 30, percent: 15, bars: 22, days: 32 }, 'AAPL')).toEqual(['+30.00 (+15.00%)', '22 bars, 32d'])
  expect(measureLines({ change: -0.0125, percent: -1.37, bars: 1, days: 1 }, 'EUR=X')).toEqual(['−0.0125 (−1.37%)', '1 bar, 1d'])
})
