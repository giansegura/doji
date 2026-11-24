import { expect, test } from 'vitest'
import type { Split, TrendLine } from '../../shared/types'
import { adjustLinesForSplits, splitBasis } from './splits'

const line = (over: Partial<TrendLine>): TrendLine => ({
  id: 'a',
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2020-07-01', value: 400 },
  p2: { date: '2020-07-20', value: 480 },
  color: '#2962FF',
  width: 2,
  extendRight: false,
  pricedAt: '2020-08-01',
  ...over,
})

const split41: Split = { date: '2020-08-31', numerator: 4, denominator: 1 }

test('Should rescale price lines drawn before a split', () => {
  const out = adjustLinesForSplits([line({})], [split41])
  expect(out.changed).toBe(true)
  expect(out.lines[0].p1.value).toBe(100)
  expect(out.lines[0].p2.value).toBe(120)
  expect(out.lines[0].pricedAt).toBe('2020-08-31')
})

test('Should not apply the same split twice', () => {
  const once = adjustLinesForSplits([line({})], [split41])
  const twice = adjustLinesForSplits(once.lines, [split41])
  expect(twice.changed).toBe(false)
  expect(twice.lines[0].p1.value).toBe(100)
})

test('Should compound several later splits and ignore earlier ones', () => {
  const splits = [{ date: '2014-06-09', numerator: 7, denominator: 1 }, split41, { date: '2021-01-04', numerator: 2, denominator: 1 }]
  const out = adjustLinesForSplits([line({})], splits)
  expect(out.lines[0].p1.value).toBe(50)
  expect(out.lines[0].pricedAt).toBe('2021-01-04')
})

test('Should leave RSI lines untouched', () => {
  const out = adjustLinesForSplits([line({ pane: 'rsi' })], [split41])
  expect(out.changed).toBe(false)
  expect(out.lines[0].p1.value).toBe(400)
})

test('Should leave lines drawn on or after the split date untouched', () => {
  const out = adjustLinesForSplits([line({ pricedAt: '2020-08-31' })], [split41])
  expect(out.changed).toBe(false)
  expect(out.lines[0].pricedAt).toBe('2020-08-31')
})

test('Should keep the dates of the points', () => {
  const out = adjustLinesForSplits([line({})], [split41])
  expect(out.lines[0].p1.date).toBe('2020-07-01')
  expect(out.lines[0].p2.date).toBe('2020-07-20')
})

test('Should adjust a line drawn on the day of the split on data that did not know it yet', () => {
  const drawnOnOldData = line({ pricedAt: splitBasis([{ date: '2014-06-09', numerator: 7, denominator: 1 }]) })
  const out = adjustLinesForSplits([drawnOnOldData], [{ date: '2014-06-09', numerator: 7, denominator: 1 }, split41])
  expect(out.changed).toBe(true)
  expect(out.lines[0].p1.value).toBe(100)
})

test('Should settle after one pass whatever the order of the splits', () => {
  const splits = [{ date: '2021-01-04', numerator: 2, denominator: 1 }, split41]
  const once = adjustLinesForSplits([line({})], splits)
  expect(once.lines[0].pricedAt).toBe('2021-01-04')
  expect(adjustLinesForSplits(once.lines, splits).changed).toBe(false)
})

test('Should name the latest split as the basis of freshly priced lines', () => {
  expect(splitBasis([split41, { date: '2014-06-09', numerator: 7, denominator: 1 }])).toBe('2020-08-31')
  expect(splitBasis([])).toBe('0000-01-01')
})

test('Should not adjust a line priced on the current basis', () => {
  const splits = [{ date: '2014-06-09', numerator: 7, denominator: 1 }, split41]
  expect(adjustLinesForSplits([line({ pricedAt: splitBasis(splits) })], splits).changed).toBe(false)
})
