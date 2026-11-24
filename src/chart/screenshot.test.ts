import { expect, test } from 'vitest'
import { imageName } from './screenshot'

test('Should name the image after the symbol, the timeframe and the day', () => {
  expect(imageName('AAPL', 'D', new Date(2026, 10, 23, 9, 5))).toBe('doji-AAPL-1D-2026-11-23.png')
  expect(imageName('BRK-B', 'W', new Date(2027, 0, 4))).toBe('doji-BRK-B-1W-2027-01-04.png')
})

test('Should keep only safe characters in the file name', () => {
  expect(imageName('^GSPC', 'D', new Date(2026, 10, 23))).toBe('doji-GSPC-1D-2026-11-23.png')
})
