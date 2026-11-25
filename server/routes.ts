import { MAX_CALENDAR_SYMBOLS } from '../shared/earningsCalendarBatches'
import { normalizeState } from '../shared/normalizeState'
import { type StateChanges, applyChanges } from '../shared/stateChanges'
import { SYMBOL_PATTERN } from '../shared/symbols'
import type { HistoryCache } from './historyCache'
import type { Logo, LogoStore } from './logoStore'
import type { EarningsSource } from './provider/earnings'
import { type Telegram, type TelegramErrorKind, isTelegramError } from './telegram'
import { type DataProvider, isProviderError } from './provider/yahoo'
import type { StateStore } from './stateStore'
import type { WatchMetrics } from './watchMetrics'

export type ApiRequest = { method: string; path: string; query: URLSearchParams; body: unknown }

export type ApiResult = { status: number; body: unknown } | { status: 200; image: Logo }

type ApiDeps = {
  history: HistoryCache
  provider: DataProvider
  state: StateStore
  logos: LogoStore
  earnings: EarningsSource
  telegram: Telegram
  metrics: WatchMetrics
  testPrices?: (prices: Record<string, number>) => Promise<unknown>
}

type Route = (request: ApiRequest) => Promise<ApiResult>

const LOCAL_HOSTNAMES = ['127.0.0.1', 'localhost', '[::1]']
const OWN_FETCH_SITES = ['same-origin', 'none']
const WRITING_METHODS = ['PUT', 'PATCH']
const MAX_WATCHLIST_SYMBOLS = 200

const ok = (body: unknown): ApiResult => ({ status: 200, body })

const symbolsIn = (query: URLSearchParams, most: number): string[] =>
  [
    ...new Set(
      (query.get('symbols') ?? '')
        .split(',')
        .filter((symbol) => SYMBOL_PATTERN.test(symbol))
        .map((symbol) => symbol.toUpperCase()),
    ),
  ].slice(0, most)

const fail = (status: number, error: string): ApiResult => ({ status, body: { error } })

const TELEGRAM_STATUS: Record<TelegramErrorKind, number> = {
  invalid_token: 400,
  not_connected: 409,
  no_message: 409,
  not_linked: 409,
  unavailable: 502,
}

const failureFor = (error: unknown): ApiResult => {
  if (isTelegramError(error)) return fail(TELEGRAM_STATUS[error.kind], error.kind)
  if (!isProviderError(error)) return fail(500, 'internal')
  if (error.kind === 'not_found') return fail(404, 'not_found')
  return fail(502, 'unavailable')
}

const isWholeState = (body: unknown): body is { rev: number } => {
  const candidate = body as { rev?: unknown; watchlists?: unknown; lines?: unknown } | null
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    Number.isInteger(candidate.rev) &&
    Array.isArray(candidate.watchlists) &&
    typeof candidate.lines === 'object' &&
    candidate.lines !== null &&
    !Array.isArray(candidate.lines)
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStateChange = (body: unknown): body is { rev: number; changes: StateChanges } => {
  if (!isRecord(body) || !Number.isInteger(body.rev) || !isRecord(body.changes)) return false
  const { lines } = body.changes
  return lines === undefined || (isRecord(lines) && Object.values(lines).every(Array.isArray))
}

export const expectsBody = (method: string): boolean => WRITING_METHODS.includes(method)

export const parseRequestUrl = (target: string | undefined): URL | null => {
  try {
    return new URL(target ?? '/', 'http://127.0.0.1')
  } catch {
    return null
  }
}

export const isLocalHost = (host: string | undefined): boolean =>
  host !== undefined && LOCAL_HOSTNAMES.includes(host.replace(/:\d+$/, ''))

export const isOwnRequest = (fetchSite: string | string[] | undefined): boolean =>
  fetchSite === undefined || (typeof fetchSite === 'string' && OWN_FETCH_SITES.includes(fetchSite))

export const createApi = (deps: ApiDeps): Route => {
  const routes: Record<string, Route> = {
    'GET /api/history': async ({ query }) => {
      const symbol = query.get('symbol') ?? ''
      if (!SYMBOL_PATTERN.test(symbol)) return fail(400, 'invalid_symbol')
      return ok(await (query.get('cached') === '1' ? deps.history.peek(symbol) : deps.history.get(symbol)))
    },
    'GET /api/search': async ({ query }) => {
      const text = (query.get('q') ?? '').trim()
      if (!text) return ok([])
      return ok(await deps.provider.search(text))
    },
    'GET /api/quotes': async ({ query }) => {
      const symbols = (query.get('symbols') ?? '')
        .split(',')
        .filter((symbol) => SYMBOL_PATTERN.test(symbol))
        .map((symbol) => symbol.toUpperCase())
      if (symbols.length === 0) return ok([])
      return ok(await deps.provider.quotes(symbols))
    },
    'GET /api/logo': async ({ query }) => {
      const symbol = query.get('symbol') ?? ''
      if (!SYMBOL_PATTERN.test(symbol)) return fail(400, 'invalid_symbol')
      const image = await deps.logos.get(symbol)
      return image ? { status: 200, image } : fail(404, 'not_found')
    },
    'GET /api/earnings': async ({ query }) => {
      const symbol = query.get('symbol') ?? ''
      if (!SYMBOL_PATTERN.test(symbol)) return fail(400, 'invalid_symbol')
      return ok(await deps.earnings.get(symbol))
    },
    'GET /api/watchlist/metrics': async ({ query }) => {
      const symbols = symbolsIn(query, MAX_WATCHLIST_SYMBOLS)
      if (symbols.length === 0) return ok({ metrics: {}, pending: 0 })
      return ok(await deps.metrics.read(symbols, query.get('level') === '1'))
    },
    'GET /api/earnings/calendar': async ({ query }) => {
      const symbols = symbolsIn(query, MAX_CALENDAR_SYMBOLS)
      if (symbols.length > 0) deps.earnings.warm(symbols).catch(() => undefined)
      const earnings = Object.fromEntries(
        symbols.flatMap((symbol) => {
          const found = deps.earnings.peek(symbol)
          return found ? [[symbol, found]] : []
        }),
      )
      return ok({ earnings, pending: deps.earnings.pending() })
    },
    'GET /api/telegram': async () => ok(await deps.telegram.status()),
    'PUT /api/telegram': async ({ body }) => {
      const token = (body as { token?: unknown } | null)?.token
      if (typeof token !== 'string') return fail(400, 'invalid_token')
      return ok(await deps.telegram.connect(token))
    },
    'POST /api/telegram/link': async () => ok(await deps.telegram.link()),
    'POST /api/telegram/test': async () => {
      await deps.telegram.test()
      return ok({ ok: true })
    },
    'DELETE /api/telegram': async () => ok(await deps.telegram.disconnect()),
    'PUT /api/test/prices': async ({ body }) => {
      if (!deps.testPrices) return fail(404, 'not_found')
      const prices = Object.fromEntries(
        Object.entries(isRecord(body) ? body : {}).filter(
          (entry): entry is [string, number] => SYMBOL_PATTERN.test(entry[0]) && typeof entry[1] === 'number' && Number.isFinite(entry[1]),
        ),
      )
      return ok({ fired: await deps.testPrices(prices) })
    },
    'GET /api/state': async () => ok(await deps.state.read()),
    'PUT /api/state': async ({ body }) => {
      if (!isWholeState(body)) return fail(400, 'invalid_state')
      const outcome = await deps.state.save(normalizeState(body), body.rev)
      return outcome.ok ? ok({ ok: true, rev: outcome.rev }) : fail(409, 'conflict')
    },
    'PATCH /api/state': async ({ body }) => {
      if (!isStateChange(body)) return fail(400, 'invalid_state')
      const current = await deps.state.read()
      if (current.rev !== body.rev) return fail(409, 'conflict')
      const outcome = await deps.state.save(normalizeState(applyChanges(current, body.changes)), body.rev)
      return outcome.ok ? ok({ ok: true, rev: outcome.rev }) : fail(409, 'conflict')
    },
  }

  return async (request) => {
    const key = `${request.method} ${request.path}`
    if (!Object.hasOwn(routes, key)) return fail(404, 'not_found')
    try {
      return await routes[key](request)
    } catch (error) {
      return failureFor(error)
    }
  }
}
