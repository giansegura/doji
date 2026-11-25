export const SYMBOL_PATTERN = /^[A-Za-z0-9^][A-Za-z0-9.\-^=]{0,14}$/

const FOREX_PAIR = /^([A-Z]{3})([A-Z]{3})?=X$/i
const FOREX_WIDE_ABOVE = 20
const CRYPTO = /^[A-Z0-9]{2,10}-[A-Z]{3,4}$/i
const TINY = 0.0001
const SMALL = 0.01

export const tradesEveryDay = (symbol: string): boolean => CRYPTO.test(symbol.trim())

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
  if (magnitude > 0 && magnitude < TINY) return 8
  if (magnitude > 0 && magnitude < SMALL) return 6
  return magnitude > 0 && magnitude < 1 ? 4 : 2
}
