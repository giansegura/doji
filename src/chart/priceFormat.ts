import { priceDigits } from '../../shared/symbols'

export const formatWithPrecision = (precision: number) => ({
  type: 'price' as const,
  precision,
  minMove: Number((1 / 10 ** precision).toFixed(precision)),
})

export const priceFormatOf = (symbol: string, price: number) => formatWithPrecision(priceDigits(symbol, price))
