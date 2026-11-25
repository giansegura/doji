import type { Bar, History } from './types'

export type FxPair = { pair: string; factor: number }

const CENTS: Record<string, string> = { GBp: 'GBP', GBX: 'GBP', ZAc: 'ZAR', ILA: 'ILS' }
const EURO = 'EUR'
const CENT = 0.01

export const fxPairOf = (currency: string | undefined): FxPair | null => {
  if (!currency || currency === EURO) return null
  const whole = CENTS[currency]
  return whole ? { pair: `EUR${whole}=X`, factor: CENT } : { pair: `EUR${currency.toUpperCase()}=X`, factor: 1 }
}

const rateFinder = (fx: Bar[]) => {
  const sorted = [...fx].sort((a, b) => a.time.localeCompare(b.time))
  return (date: string): number | null => {
    let low = 0
    let high = sorted.length - 1
    let found: Bar | null = null
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      if (sorted[middle].time <= date) {
        found = sorted[middle]
        low = middle + 1
      } else {
        high = middle - 1
      }
    }
    return found && found.close > 0 ? found.close : null
  }
}

export const convertHistory = (history: History, fx: Bar[], factor: number): History => {
  const rateOn = rateFinder(fx)
  const bars = history.bars.flatMap((bar): Bar[] => {
    const rate = rateOn(bar.time)
    if (rate === null) return []
    const toEuro = (price: number): number => (price * factor) / rate
    return [{ ...bar, open: toEuro(bar.open), high: toEuro(bar.high), low: toEuro(bar.low), close: toEuro(bar.close) }]
  })
  const dividends = (history.dividends ?? []).flatMap((dividend) => {
    const rate = rateOn(dividend.date)
    return rate === null ? [] : [{ date: dividend.date, amount: (dividend.amount * factor) / rate }]
  })
  return { ...history, bars, dividends, currency: EURO }
}

export const convertPrice = (price: number, fx: Bar[], factor: number): number | null => {
  const latest = [...fx].sort((a, b) => a.time.localeCompare(b.time)).at(-1)
  return latest && latest.close > 0 ? (price * factor) / latest.close : null
}
