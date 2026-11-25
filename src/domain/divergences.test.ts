import { expect, test } from 'vitest'
import { findDivergences } from './divergences'

const bars = (lows: number[], highs: number[]) => lows.map((low, index) => ({ low, high: highs[index] }))

const wave = (values: number[]) => values

test('Should join two lows where the price made a lower low and the RSI a higher one', () => {
  const lows = wave([20, 19, 18, 17, 16, 10, 16, 17, 18, 19, 20, 19, 18, 17, 16, 8, 16, 17, 18, 19, 20])
  const highs = lows.map((low) => low + 5)
  const rsi = lows.map((_, index) => (index === 5 ? 25 : index === 15 ? 32 : 50))
  expect(findDivergences(bars(lows, highs), rsi, 5)).toEqual([{ kind: 'bullish', from: 5, to: 15, priceFrom: 10, priceTo: 8, rsiFrom: 25, rsiTo: 32 }])
})

test('Should join two highs where the price made a higher high and the RSI a lower one', () => {
  const highs = wave([20, 21, 22, 23, 24, 30, 24, 23, 22, 21, 20, 21, 22, 23, 24, 33, 24, 23, 22, 21, 20])
  const lows = highs.map((high) => high - 5)
  const rsi = highs.map((_, index) => (index === 5 ? 75 : index === 15 ? 68 : 50))
  expect(findDivergences(bars(lows, highs), rsi, 5)).toEqual([{ kind: 'bearish', from: 5, to: 15, priceFrom: 30, priceTo: 33, rsiFrom: 75, rsiTo: 68 }])
})

test('Should find nothing when the RSI agrees with the price or is not known there', () => {
  const lows = wave([20, 19, 18, 17, 16, 10, 16, 17, 18, 19, 20, 19, 18, 17, 16, 8, 16, 17, 18, 19, 20])
  const highs = lows.map((low) => low + 5)
  expect(findDivergences(bars(lows, highs), lows.map((_, index) => (index === 15 ? 20 : 30)), 5)).toEqual([])
  expect(findDivergences(bars(lows, highs), lows.map(() => null), 5)).toEqual([])
})
