import { MAX_CALENDAR_SYMBOLS } from '../shared/earningsCalendarBatches'
import { MAX_METRICS_SYMBOLS } from '../shared/limits'
import { normalizeState } from '../shared/normalizeState'
import { type StateChanges, applyChanges } from '../shared/stateChanges'
import { SYMBOL_PATTERN } from '../shared/symbols'
import type { HistoryCache } from './historyCache'
import type { Logo, LogoStore } from './logoStore'
import type { EarningsSource } from './provider/earnings'
import type { BackupHistory } from './backupHistory'
import { type BackupKey, isBackupKeyError } from './backupKey'
import { type GoogleErrorKind, isGoogleError } from './googleAuth'
import type { GoogleSync } from './googleSync'
import type { NewsCache } from './newsCache'
import { resolveSymbols } from './resolveSymbols'
import type { ProfileSource } from './provider/profile'
import { type Telegram, type TelegramErrorKind, isTelegramError } from './telegram'
import { type DataProvider, isProviderError } from './provider/yahoo'
import type { SaveOutcome, StateStore } from './stateStore'
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
  profiles: ProfileSource
  news: NewsCache
  testPrices?: (prices: Record<string, number>) => Promise<unknown>
  backup?: BackupHistory
  backupKey: BackupKey
  testYahoo?: (down: boolean) => void
  google?: GoogleSync
}

type Route = (request: ApiRequest) => Promise<ApiResult>

const LOCAL_HOSTNAMES = ['127.0.0.1', 'localhost', '[::1]']
const OWN_FETCH_SITES = ['same-origin', 'none']
const WRITING_METHODS = ['PUT', 'PATCH']
const MAX_RESOLVE_GROUPS = 50
const MAX_CANDIDATES = 5
const SAVES_REMEMBERED = 20
const REFUSED: SaveOutcome = { ok: false, reason: 'conflict' }

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

const GOOGLE_STATUS: Record<GoogleErrorKind, number> = {
  not_configured: 409,
  invalid_state: 400,
  denied: 400,
  expired: 409,
  offline: 502,
  unavailable: 502,
}

const failureFor = (error: unknown): ApiResult => {
  if (isTelegramError(error)) return fail(TELEGRAM_STATUS[error.kind], error.kind)
  if (isGoogleError(error)) return fail(GOOGLE_STATUS[error.kind], error.kind)
  if (!isProviderError(error)) return fail(500, 'internal')
  if (error.kind === 'not_found') return fail(404, 'not_found')
  return fail(502, 'unavailable')
}

// A save may carry its own name and the name of the one it follows.
type SaveRequest = { rev: number; saveId?: unknown; follows?: unknown }

const isWholeState = (body: unknown): body is SaveRequest => {
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

const isStateChange = (body: unknown): body is SaveRequest & { changes: StateChanges } => {
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

const savedAnswer = (outcome: SaveOutcome): ApiResult =>
  outcome.ok ? ok({ ok: true, rev: outcome.rev }) : fail(409, 'conflict')

export const createApi = (deps: ApiDeps): Route => {
  const recentSaves = new Map<string, Promise<SaveOutcome>>()
  let received: Promise<unknown> = Promise.resolve()

  // A page being left sends its latest change while the save before it may still be waiting to be written. The
  // follower waits for that one and goes only on top of what it wrote, so it never undoes what someone else saved.
  const inOrder = ({ rev, saveId, follows }: SaveRequest, write: (base: number) => Promise<SaveOutcome>) => {
    const before = typeof follows === 'string' ? (recentSaves.get(follows) ?? Promise.resolve(REFUSED)) : null
    const outcome = before ? before.then((first) => (first.ok ? write(first.rev) : first)) : write(rev)
    received = Promise.allSettled([received, outcome]).then(() => undefined)
    if (typeof saveId === 'string') recentSaves.set(saveId, outcome)
    if (recentSaves.size > SAVES_REMEMBERED) recentSaves.delete(recentSaves.keys().next().value as string)
    return outcome
  }

  const withGoogle = async (work: (google: GoogleSync) => Promise<unknown>): Promise<ApiResult> =>
    deps.google ? ok(await work(deps.google)) : fail(404, 'not_found')

  const routes: Record<string, Route> = {
    'GET /api/history': async ({ query }) => {
      const symbol = query.get('symbol') ?? ''
      if (!SYMBOL_PATTERN.test(symbol)) return fail(400, 'invalid_symbol')
      if (query.get('cached') === '1') return ok(await deps.history.peek(symbol))
      const backup = deps.backup
      return ok(await (backup ? backup.serve(symbol, () => deps.history.get(symbol)) : deps.history.get(symbol)))
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
    'GET /api/resolve': async ({ query }) => {
      const groups = (query.get('symbols') ?? '')
        .split(',')
        .filter(Boolean)
        .map((group) =>
          group
            .split('|')
            .filter((symbol) => SYMBOL_PATTERN.test(symbol))
            .map((symbol) => symbol.toUpperCase())
            .slice(0, MAX_CANDIDATES),
        )
      if (groups.length > MAX_RESOLVE_GROUPS) return fail(400, 'too_many_symbols')
      return ok({ found: await resolveSymbols(groups, async (symbol) => (await deps.history.get(symbol, false)).info) })
    },
    'GET /api/logo': async ({ query }) => {
      const symbol = query.get('symbol') ?? ''
      if (!SYMBOL_PATTERN.test(symbol)) return fail(400, 'invalid_symbol')
      const image = await deps.logos.get(symbol)
      return image ? { status: 200, image } : fail(404, 'not_found')
    },
    'GET /api/news': async ({ query }) => {
      const symbol = query.get('symbol') ?? ''
      if (!SYMBOL_PATTERN.test(symbol)) return fail(400, 'invalid_symbol')
      return ok(await deps.news.get(symbol))
    },
    'GET /api/profile': async ({ query }) => {
      const symbol = query.get('symbol') ?? ''
      if (!SYMBOL_PATTERN.test(symbol)) return fail(400, 'invalid_symbol')
      const profile = await deps.profiles.get(symbol)
      return profile ? ok(profile) : fail(404, 'not_found')
    },
    'GET /api/earnings': async ({ query }) => {
      const symbol = query.get('symbol') ?? ''
      if (!SYMBOL_PATTERN.test(symbol)) return fail(400, 'invalid_symbol')
      return ok(await deps.earnings.get(symbol))
    },
    'GET /api/watchlist/metrics': async ({ query }) => {
      const symbols = symbolsIn(query, MAX_METRICS_SYMBOLS)
      if (symbols.length === 0) return ok({ metrics: {}, pending: 0 })
      return ok(await deps.metrics.read(symbols, query.get('level') === '1', query.get('all') === '1'))
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
    'GET /api/google': () => withGoogle((google) => google.status()),
    'POST /api/google/sign-in': () => withGoogle((google) => google.signIn()),
    'POST /api/google/sync': () => withGoogle((google) => google.syncNow()),
    'PUT /api/google/choice': async ({ body }) => {
      if (!deps.google) return fail(404, 'not_found')
      const keep = (body as { keep?: unknown } | null)?.keep
      if (keep !== 'local' && keep !== 'drive') return fail(400, 'invalid_choice')
      return ok(await deps.google.choose(keep))
    },
    'DELETE /api/google': () => withGoogle((google) => google.signOut()),
    'GET /api/backup': async () => ok(await deps.backupKey.status()),
    'PUT /api/backup': async ({ body }) => {
      const key = (body as { key?: unknown } | null)?.key
      if (typeof key !== 'string') return fail(400, 'invalid_key')
      try {
        return ok(await deps.backupKey.set(key))
      } catch (error) {
        if (isBackupKeyError(error)) return fail(400, 'invalid_key')
        throw error
      }
    },
    'DELETE /api/backup': async () => ok(await deps.backupKey.clear()),
    'PUT /api/test/yahoo': async ({ body }) => {
      if (!deps.testYahoo) return fail(404, 'not_found')
      const down = (body as { down?: unknown } | null)?.down === true
      deps.testYahoo(down)
      return ok({ down })
    },
    'PUT /api/test/prices': async ({ body }) => {
      if (!deps.testPrices) return fail(404, 'not_found')
      const prices = Object.fromEntries(
        Object.entries(isRecord(body) ? body : {}).filter(
          (entry): entry is [string, number] => SYMBOL_PATTERN.test(entry[0]) && typeof entry[1] === 'number' && Number.isFinite(entry[1]),
        ),
      )
      return ok({ fired: await deps.testPrices(prices) })
    },
    // A page reloaded while a save is held up has to start from what that save writes, or its next one is refused.
    'GET /api/state': async () => {
      await received
      return ok(await deps.state.read())
    },
    'PUT /api/state': async ({ body }) => {
      if (!isWholeState(body)) return fail(400, 'invalid_state')
      const state = normalizeState(body)
      return savedAnswer(await inOrder(body, (base) => deps.state.save(state, base)))
    },
    'PATCH /api/state': async ({ body }) => {
      if (!isStateChange(body)) return fail(400, 'invalid_state')
      const outcome = await inOrder(body, async (base) => {
        const current = await deps.state.read()
        if (current.rev !== base) return REFUSED
        return deps.state.save(normalizeState(applyChanges(current, body.changes)), base)
      })
      return savedAnswer(outcome)
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
