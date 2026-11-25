import type { Bar, History } from '../../shared/types'
import { providerError } from './yahoo'

export type TwelveFetch = (url: string) => Promise<{ status: number; text: () => Promise<string> }>

export type BackupSource = { name: string; history: (symbol: string) => Promise<History> }

export const TWELVE_DATA = 'Twelve Data'

const CRYPTO = /^([A-Z0-9]{2,10})-([A-Z]{3,4})$/
const PAIR = /^([A-Z]{3})([A-Z]{3})?=X$/
const PLAIN = /^[A-Z]{1,6}(-[A-Z])?$/
const OUTPUT_SIZE = 5000

export const twelveSymbol = (symbol: string): string | null => {
  const upper = symbol.trim().toUpperCase()
  const pair = PAIR.exec(upper)
  if (pair) return pair[2] ? `${pair[1]}/${pair[2]}` : `USD/${pair[1]}`
  const crypto = CRYPTO.exec(upper)
  if (crypto && crypto[1].length > 1 && !PLAIN.test(upper)) return `${crypto[1]}/${crypto[2]}`
  return PLAIN.test(upper) ? upper.replace('-', '.') : null
}

const numberOf = (value: unknown): number | null => {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

export const parseTwelveSeries = (json: unknown, symbol: string, fetchedAt: string): History => {
  const answer = (json ?? {}) as { meta?: Record<string, unknown>; values?: unknown[] }
  const bars = (Array.isArray(answer.values) ? answer.values : [])
    .flatMap((raw): Bar[] => {
      const row = (raw ?? {}) as Record<string, unknown>
      const time = typeof row.datetime === 'string' ? row.datetime.slice(0, 10) : ''
      const [open, high, low, close] = [row.open, row.high, row.low, row.close].map(numberOf)
      if (!time || open === null || high === null || low === null || close === null) return []
      return [{ time, open, high, low, close, volume: numberOf(row.volume) ?? 0 }]
    })
    .sort((a, b) => a.time.localeCompare(b.time))
  const meta = answer.meta ?? {}
  const currency = typeof meta.currency === 'string' ? { currency: meta.currency } : {}
  return {
    info: { symbol, name: symbol, exchange: typeof meta.exchange === 'string' ? meta.exchange : '' },
    bars,
    splits: [],
    fetchedAt,
    stale: false,
    source: TWELVE_DATA,
    ...currency,
  }
}

export const createTwelveData = (deps: { fetch: TwelveFetch; apiUrl: string; key: () => Promise<string | null>; now?: () => Date }): BackupSource => {
  const history = async (symbol: string): Promise<History> => {
    const key = await deps.key()
    if (!key) throw providerError('unavailable', 'No Twelve Data key')
    const wanted = twelveSymbol(symbol)
    if (!wanted) throw providerError('not_found', 'Twelve Data does not cover this symbol here')
    const query = new URLSearchParams({ symbol: wanted, interval: '1day', outputsize: String(OUTPUT_SIZE), order: 'asc', apikey: key })
    const answer = await deps.fetch(`${deps.apiUrl}/time_series?${query}`).catch(() => null)
    if (!answer || answer.status !== 200) throw providerError('unavailable', 'Twelve Data did not answer')
    const json = await answer
      .text()
      .then((text) => JSON.parse(text) as { status?: unknown })
      .catch(() => {
        throw providerError('unavailable', 'Twelve Data sent a broken answer')
      })
    if (json.status !== 'ok') throw providerError('unavailable', 'Twelve Data refused the request')
    return parseTwelveSeries(json, symbol, (deps.now ?? (() => new Date()))().toISOString())
  }
  return { name: TWELVE_DATA, history }
}
