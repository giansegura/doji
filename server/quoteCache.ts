import type { Quote } from '../shared/types'

export type QuoteCache = { get: (symbols: string[]) => Promise<Quote[]> }

type Known = { quote: Quote | null; at: number }

export const QUOTE_FRESH_MS = 10_000

const isDefined = <T>(value: T | undefined): value is T => value !== undefined

const isQuote = (value: Quote | null | undefined): value is Quote => value !== null && value !== undefined

export const createQuoteCache = (deps: {
  fetch: (symbols: string[]) => Promise<Quote[]>
  now: () => Date
}): QuoteCache => {
  const known = new Map<string, Known>()
  const inFlight = new Map<string, Promise<void>>()

  const isFresh = (symbol: string): boolean => {
    const entry = known.get(symbol)
    return entry !== undefined && deps.now().getTime() - entry.at < QUOTE_FRESH_MS
  }

  const remember = (symbols: string[], quotes: Quote[]): void => {
    const at = deps.now().getTime()
    const bySymbol = new Map(quotes.map((quote) => [quote.symbol.toUpperCase(), quote]))
    symbols.forEach((symbol) => known.set(symbol, { quote: bySymbol.get(symbol.toUpperCase()) ?? null, at }))
  }

  const download = (symbols: string[]): Promise<void> => {
    const started = deps
      .fetch(symbols)
      .then((quotes) => remember(symbols, quotes))
      .finally(() => symbols.forEach((symbol) => inFlight.delete(symbol)))
    symbols.forEach((symbol) => inFlight.set(symbol, started))
    return started
  }

  const get = async (symbols: string[]): Promise<Quote[]> => {
    const wanted = symbols.filter((symbol) => !isFresh(symbol))
    const running = [...new Set(wanted.map((symbol) => inFlight.get(symbol)).filter(isDefined))]
    const missing = wanted.filter((symbol) => !inFlight.has(symbol))
    await Promise.all(missing.length > 0 ? [...running, download(missing)] : running)
    return symbols.map((symbol) => known.get(symbol)?.quote).filter(isQuote)
  }

  return { get }
}
