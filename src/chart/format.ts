import { priceDigits } from '../../shared/symbols'

const MINUS = '−'

const VOLUME_UNITS: [number, string][] = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'K'],
]

const fixed = (digits: number): Intl.NumberFormat =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

const twoDecimals = fixed(2)
const byDigits = new Map([2, 3, 4].map((digits) => [digits, fixed(digits)]))

export const formatPrice = (value: number, symbol = ''): string =>
  (byDigits.get(priceDigits(symbol, value)) ?? twoDecimals).format(value)

export const formatSigned = (value: number): string => {
  const rounded = Math.round(value * 100) / 100
  if (rounded > 0) return `+${twoDecimals.format(rounded)}`
  if (rounded < 0) return `${MINUS}${twoDecimals.format(-rounded)}`
  return twoDecimals.format(0)
}

export const formatPercent = (value: number): string => `${formatSigned(value)}%`

export const formatVolume = (value: number): string => {
  const unit = VOLUME_UNITS.find(([size]) => value >= size)
  if (!unit) return String(Math.round(value))
  return `${Number((value / unit[0]).toFixed(2))}${unit[1]}`
}
