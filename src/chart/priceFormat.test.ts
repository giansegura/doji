import { expect, test } from 'vitest'
import { priceFormatOf } from './priceFormat'

test('Should show two decimals for a stock and four for one under a dollar', () => {
  expect(priceFormatOf('AAPL', 350.2)).toEqual({ type: 'price', precision: 2, minMove: 0.01 })
  expect(priceFormatOf('SIRI', 0.9999)).toEqual({ type: 'price', precision: 4, minMove: 0.0001 })
})

test('Should show the decimals of forex', () => {
  expect(priceFormatOf('EURUSD=X', 1.0967)).toEqual({ type: 'price', precision: 4, minMove: 0.0001 })
  expect(priceFormatOf('JPY=X', 159.1)).toEqual({ type: 'price', precision: 3, minMove: 0.001 })
})
