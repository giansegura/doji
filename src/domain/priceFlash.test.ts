import { expect, test } from 'vitest'
import { priceFlash } from './priceFlash'

test('Should flash up from the first digit that changed when the price rises', () => {
  expect(priceFlash({ price: 111.8, text: '111.80' }, { price: 111.85, text: '111.85' })).toEqual({ direction: 'up', from: 5 })
})

test('Should flash down from the first digit that changed when the price falls', () => {
  expect(priceFlash({ price: 153.8, text: '153.80' }, { price: 153.42, text: '153.42' })).toEqual({ direction: 'down', from: 4 })
})

test('Should count the thousands separator as part of the price', () => {
  expect(priceFlash({ price: 1435.99, text: '1,435.99' }, { price: 1436.01, text: '1,436.01' })).toEqual({ direction: 'up', from: 4 })
})

test('Should flash the whole price when it gains or loses a digit', () => {
  expect(priceFlash({ price: 999.99, text: '999.99' }, { price: 1000.01, text: '1,000.01' })).toEqual({ direction: 'up', from: 0 })
  expect(priceFlash({ price: 10.02, text: '10.02' }, { price: 9.98, text: '9.98' })).toEqual({ direction: 'down', from: 0 })
})

test('Should not flash when the price did not move', () => {
  expect(priceFlash({ price: 111.8, text: '111.80' }, { price: 111.8, text: '111.80' })).toBeNull()
})

test('Should not flash when the price moved less than what is shown', () => {
  expect(priceFlash({ price: 111.801, text: '111.80' }, { price: 111.803, text: '111.80' })).toBeNull()
})
