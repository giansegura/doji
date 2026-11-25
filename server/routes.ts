import { MAX_CALENDAR_SYMBOLS } from '../shared/earningsCalendarBatches'
import { normalizeState } from '../shared/normalizeState'
import { type StateChanges, applyChanges } from '../shared/stateChanges'
import { SYMBOL_PATTERN } from '../shared/symbols'
import type { HistoryCache } from './historyCache'
import type { Logo, LogoStore } from './logoStore'
import type { EarningsSource } from './provider/earnings'
import { type DataProvider, isProviderError } from './provider/yahoo'
import type { StateStore } from './stateStore'

export type ApiRequest = { method: string; path: string; query: URLSearchParams; body: unknown }

export type ApiResult = { status: number; body: unknown } | { status: 200; image: Logo }

type ApiDeps = { history: HistoryCache; provider: DataProvider; state: StateStore; logos: LogoStore; earnings: EarningsSource }

type Route = (request: ApiRequest) => Promise<ApiResult>

const LOCAL_HOSTNAMES = ['127.0.0.1', 'localhost', '[::1]']
const OWN_FETCH_SITES = ['same-origin', 'none']
const WRITING_METHODS = ['PUT', 'PATCH']

const ok = (body: unknown): ApiResult => ({ status: 200, body })

const fail = (status: number, error: string): ApiResult => ({ status, body: { error } })

const failureFor = (error: unknown): ApiResult => {
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
    'GET /api/earnings/calendar': async ({ query }) => {
      const symbols = [
        ...new Set(
          (query.get('symbols') ?? '')
            .split(',')
            .filter((symbol) => SYMBOL_PATTERN.test(symbol))
            .map((symbol) => symbol.toUpperCase()),
        ),
      ].slice(0, MAX_CALENDAR_SYMBOLS)
      if (symbols.length > 0) deps.earnings.warm(symbols).catch(() => undefined)
      const earnings = Object.fromEntries(
        symbols.flatMap((symbol) => {
          const found = deps.earnings.peek(symbol)
          return found ? [[symbol, found]] : []
        }),
      )
      return ok({ earnings, pending: deps.earnings.pending() })
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
