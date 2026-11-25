import { expect, test } from 'vitest'
import type { Quote } from '../../shared/types'
import { formatMoney, holdingGain, totalsByCurrency } from './holdings'

const quote = (symbol: string, price: number, currency?: string): Quote => ({
  symbol,
  price,
  change: 0,
  changePercent: 0,
  ...(currency ? { currency } : {}),
})

test('Should work out the gain of a position in percent and in money', () => {
  expect(holdingGain({ quantity: 100, price: 50 }, 55)).toEqual({ percent: 10, value: 500, cost: 5000 })
  expect(holdingGain({ quantity: 10, price: 200 }, 150)).toEqual({ percent: -25, value: -500, cost: 2000 })
})

test('Should write money with its currency, signed, and shorter when it is large', () => {
  expect(formatMoney(500, 'USD')).toBe('+$500')
  expect(formatMoney(-1234.5, 'EUR')).toBe('−€1,235')
  expect(formatMoney(12_345, 'USD')).toBe('+$12.3K')
  expect(formatMoney(0, 'GBP')).toBe('£0')
  expect(formatMoney(25, undefined)).toBe('+25')
})

test('Should add up the gains of the symbols shown, separately for each currency', () => {
  const holdings = { KO: { quantity: 100, price: 50 }, SAN: { quantity: 1000, price: 4 }, MSFT: { quantity: 1, price: 400 }, PEP: { quantity: 5, price: 150 } }
  const quotes = { KO: quote('KO', 55, 'USD'), SAN: quote('SAN', 5, 'EUR'), MSFT: quote('MSFT', 380, 'USD') }
  expect(totalsByCurrency(['KO', 'SAN', 'MSFT', 'PEP', 'NVDA'], holdings, quotes)).toEqual([
    { currency: 'USD', value: 480, percent: 480 / 5400 * 100 },
    { currency: 'EUR', value: 1000, percent: 25 },
  ])
})
