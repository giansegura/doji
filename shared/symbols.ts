export const SYMBOL_PATTERN = /^[A-Za-z0-9^][A-Za-z0-9.\-^=]{0,14}$/

const FOREX_PAIR = /^([A-Z]{3})([A-Z]{3})?=X$/i
const FOREX_WIDE_ABOVE = 20

export const currencyPair = (symbol: string): [string, string] | null => {
  const match = FOREX_PAIR.exec(symbol.trim())
  if (!match) return null
  const [, first, second] = match
  return second ? [first.toUpperCase(), second.toUpperCase()] : ['USD', first.toUpperCase()]
}

export const displaySymbol = (symbol: string): string => currencyPair(symbol)?.join('') ?? symbol

export const priceDigits = (symbol: string, value: number): number => {
  const magnitude = Math.abs(value)
  if (currencyPair(symbol)) return magnitude >= FOREX_WIDE_ABOVE ? 3 : 4
  return magnitude > 0 && magnitude < 1 ? 4 : 2
}
