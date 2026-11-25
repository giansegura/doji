import { SYMBOL_PATTERN, currencyPair } from '../../shared/symbols'
import type { SymbolInfo } from '../../shared/types'

const SUFFIXES: Record<string, string[]> = {
  BME: ['.MC'],
  XETR: ['.DE'],
  FWB: ['.F'],
  LSE: ['.L'],
  LSIN: ['.IL'],
  EURONEXT: ['.PA', '.AS', '.BR', '.LS', '.IR'],
  MIL: ['.MI'],
  SIX: ['.SW'],
  VIE: ['.VI'],
  OMXSTO: ['.ST'],
  OMXCOP: ['.CO'],
  OMXHEX: ['.HE'],
  OMXICE: ['.IC'],
  OSL: ['.OL'],
  GPW: ['.WA'],
  ATHEX: ['.AT'],
  BIST: ['.IS'],
  TSX: ['.TO'],
  TSXV: ['.V'],
  NEO: ['.NE'],
  BMFBOVESPA: ['.SA'],
  BMV: ['.MX'],
  BCBA: ['.BA'],
  ASX: ['.AX'],
  NZX: ['.NZ'],
  HKEX: ['.HK'],
  TSE: ['.T'],
  SSE: ['.SS'],
  SZSE: ['.SZ'],
  KRX: ['.KS', '.KQ'],
  TWSE: ['.TW'],
  TPEX: ['.TWO'],
  SGX: ['.SI'],
  NSE: ['.NS'],
  BSE: ['.BO'],
  SET: ['.BK'],
  IDX: ['.JK'],
  MYX: ['.KL'],
  TASE: ['.TA'],
  TADAWUL: ['.SR'],
  JSE: ['.JO'],
}

const NAMED: Record<string, string> = {
  'SP:SPX': '^GSPC',
  'TVC:SPX': '^GSPC',
  'NASDAQ:NDX': '^NDX',
  'NASDAQ:IXIC': '^IXIC',
  'TVC:IXIC': '^IXIC',
  'DJ:DJI': '^DJI',
  'TVC:DJI': '^DJI',
  'TVC:VIX': '^VIX',
  'CBOE:VIX': '^VIX',
  'TVC:RUT': '^RUT',
  'TVC:DXY': 'DX-Y.NYB',
  'TVC:US10Y': '^TNX',
  'TVC:NI225': '^N225',
  'TVC:UKX': '^FTSE',
  'XETR:DAX': '^GDAXI',
  'TVC:DEU40': '^GDAXI',
  'EURONEXT:PX1': '^FCHI',
  'TVC:SX5E': '^STOXX50E',
  'BME:IBC': '^IBEX',
  'TVC:HSI': '^HSI',
  'TVC:GOLD': 'GC=F',
  'TVC:SILVER': 'SI=F',
  'TVC:USOIL': 'CL=F',
  'TVC:UKOIL': 'BZ=F',
}

const CRYPTO_EXCHANGES = ['BINANCE', 'COINBASE', 'BITSTAMP', 'KRAKEN', 'BITFINEX', 'BYBIT', 'OKX', 'KUCOIN', 'GEMINI', 'BITGET', 'CRYPTO']
const CRYPTO_QUOTES: [string, string][] = [
  ['USDT', 'USD'],
  ['USDC', 'USD'],
  ['BUSD', 'USD'],
  ['USD', 'USD'],
  ['EUR', 'EUR'],
  ['GBP', 'GBP'],
]
const FOREX_EXCHANGES = ['FX', 'FX_IDC', 'OANDA', 'FOREXCOM', 'SAXO', 'FXCM', 'ICMARKETS', 'PEPPERSTONE', 'CAPITALCOM']
const CONTINUOUS_FUTURE = /^([A-Z0-9]+?)[12]!$/
const FOREX_TICKER = /^[A-Z]{6}$/
const HONG_KONG_DIGITS = 4

const valid = (symbol: string): string[] => (SYMBOL_PATTERN.test(symbol) ? [symbol] : [])

const asYahooTicker = (ticker: string): string => ticker.replace(/\.+$/, '').replace(/\./g, '-')

const cryptoOf = (ticker: string): string[] => {
  const quote = CRYPTO_QUOTES.find(([suffix]) => ticker.endsWith(suffix) && ticker.length > suffix.length)
  return quote ? valid(`${ticker.slice(0, -quote[0].length)}-${quote[1]}`) : []
}

const withSuffixes = (exchange: string, ticker: string, suffixes: string[]): string[] => {
  const base = exchange === 'HKEX' && /^\d+$/.test(ticker) ? ticker.padStart(HONG_KONG_DIGITS, '0') : asYahooTicker(ticker)
  return suffixes.flatMap((suffix) => valid(`${base}${suffix}`))
}

export const yahooCandidates = (entry: string): string[] => {
  const text = entry.trim().toUpperCase()
  const colon = text.indexOf(':')
  if (colon < 0) return valid(text)
  const exchange = text.slice(0, colon)
  const ticker = text.slice(colon + 1)
  const named = NAMED[text]
  const future = CONTINUOUS_FUTURE.exec(ticker)
  if (!ticker) return []
  if (named) return [named]
  if (future) return valid(`${future[1]}=F`)
  if (CRYPTO_EXCHANGES.includes(exchange)) return cryptoOf(ticker)
  if (FOREX_EXCHANGES.includes(exchange) && FOREX_TICKER.test(ticker)) return valid(`${ticker}=X`)
  if (SUFFIXES[exchange]) return withSuffixes(exchange, ticker, SUFFIXES[exchange])
  return valid(asYahooTicker(ticker))
}

const US_BY_NAME: [RegExp, string][] = [
  [/^NASDAQ/i, 'NASDAQ'],
  [/^NYSE ?Arca/i, 'AMEX'],
  [/^(NYSE ?American|NYSE ?MKT|AMEX)/i, 'AMEX'],
  [/^NYSE/i, 'NYSE'],
  [/^(Cboe|BATS)/i, 'CBOE'],
  [/^OTC/i, 'OTC'],
]

const NAMED_BACK = new Map(Object.entries(NAMED).reverse().map(([tradingView, yahoo]) => [yahoo, tradingView]))

const fromSuffix = (symbol: string): string | null => {
  const dot = symbol.lastIndexOf('.')
  if (dot <= 0) return null
  const suffix = symbol.slice(dot)
  const exchange = Object.keys(SUFFIXES).find((name) => SUFFIXES[name][0] === suffix || (name !== 'EURONEXT' && SUFFIXES[name].includes(suffix)))
  const euronext = SUFFIXES.EURONEXT.includes(suffix) ? 'EURONEXT' : null
  const market = euronext ?? exchange
  if (!market) return null
  const ticker = symbol.slice(0, dot).replace(/-/g, '.')
  return `${market}:${market === 'HKEX' ? String(Number(ticker)) : ticker}`
}

export const tradingViewSymbol = (info: SymbolInfo): string => {
  const symbol = info.symbol.toUpperCase()
  const named = NAMED_BACK.get(symbol)
  const pair = currencyPair(symbol)
  const future = /^(.+)=F$/.exec(symbol)
  const crypto = /^([A-Z0-9]+)-(USD|EUR|GBP)$/.exec(symbol)
  const us = US_BY_NAME.find(([pattern]) => pattern.test(info.exchange))
  if (named) return named
  if (pair) return `FX:${pair.join('')}`
  if (future) return `${future[1]}1!`
  if (crypto && info.exchange === 'Crypto') return `COINBASE:${crypto[1]}${crypto[2]}`
  if (symbol.startsWith('^')) return symbol.slice(1)
  return fromSuffix(symbol) ?? (us ? `${us[1]}:${symbol.replace(/-/g, '.')}` : symbol)
}
