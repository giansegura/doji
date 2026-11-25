import type { Holding, Quote } from '../../shared/types'

export type Gain = { percent: number; value: number; cost: number }

export type CurrencyTotal = { currency: string; value: number; percent: number }

const MINUS = '−'
const COMPACT_FROM = 10_000
const UNKNOWN_CURRENCY = ''

export const holdingGain = (holding: Holding, price: number): Gain => {
  const cost = holding.quantity * holding.price
  const value = holding.quantity * price - cost
  return { percent: (value / cost) * 100, value, cost }
}

export const formatMoney = (value: number, currency: string | undefined): string => {
  const large = Math.abs(value) >= COMPACT_FROM
  const options: Intl.NumberFormatOptions = {
    maximumFractionDigits: large ? 1 : 0,
    ...(large ? { notation: 'compact' } : {}),
    ...(currency ? { style: 'currency', currency, currencyDisplay: 'narrowSymbol' } : {}),
  }
  const text = new Intl.NumberFormat('en-US', options).format(Math.abs(value))
  if (!large && Math.round(Math.abs(value)) === 0) return text
  return value > 0 ? `+${text}` : `${MINUS}${text}`
}

export const totalsByCurrency = (symbols: string[], holdings: Record<string, Holding>, quotes: Record<string, Quote>): CurrencyTotal[] => {
  const sums = new Map<string, { value: number; cost: number }>()
  symbols.forEach((symbol) => {
    const holding = holdings[symbol]
    const quote = quotes[symbol]
    if (!holding || !quote) return
    const gain = holdingGain(holding, quote.price)
    const currency = quote.currency ?? UNKNOWN_CURRENCY
    const sum = sums.get(currency) ?? { value: 0, cost: 0 }
    sums.set(currency, { value: sum.value + gain.value, cost: sum.cost + gain.cost })
  })
  return [...sums.entries()].map(([currency, sum]) => ({ currency, value: sum.value, percent: (sum.value / sum.cost) * 100 }))
}
