import type { Earnings, EarningsTiming } from '../../shared/types'

export type EarningsFetch = (
  url: string,
  init: { headers: Record<string, string>; redirect?: 'manual' },
) => Promise<{ status: number; headers: { getSetCookie: () => string[] }; text: () => Promise<string> }>

export type EarningsSource = {
  get: (symbol: string) => Promise<Earnings>
  peek: (symbol: string) => Earnings | null
  warm: (symbols: string[]) => Promise<void>
  pending: () => number
}

export type EarningsStore = { load: () => Promise<unknown>; save: (data: unknown) => Promise<void> }

type Session = { cookie: string; crumb: string }

type Kept = { at: number; earnings: Earnings }

export const NO_EARNINGS: Earnings = { past: [], next: null, nextIsEstimate: false }

const COOKIE_URL = 'https://fc.yahoo.com'
const CRUMB_URL = 'https://query2.finance.yahoo.com/v1/test/getcrumb'
const SUMMARY_URL = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary'
const USER_AGENT = 'Mozilla/5.0'
const KEEP_MS = 12 * 3_600_000
const RETRY_MS = 10 * 60_000
const REFUSED = [401, 403]
const DATE = /^\d{4}-\d{2}-\d{2}$/
const CRUMB = /^[\w./-]{1,64}$/
const WORKERS = 2
const OPENING_MINUTES = 9 * 60 + 30
const CLOSING_MINUTES = 16 * 60
const NEW_YORK = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })

const timingOf = (value: unknown): EarningsTiming | null => {
  const raw = (value as { raw?: unknown } | null)?.raw
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw % 86_400 === 0) return null
  const parts = NEW_YORK.formatToParts(new Date(raw * 1000))
  const minutes = Number(parts.find((part) => part.type === 'hour')?.value) * 60 + Number(parts.find((part) => part.type === 'minute')?.value)
  if (minutes < OPENING_MINUTES) return 'pre'
  return minutes >= CLOSING_MINUTES ? 'post' : null
}

const isEarnings = (value: unknown): value is Earnings => {
  const earnings = value as Partial<Earnings> | null
  return (
    typeof earnings === 'object' &&
    earnings !== null &&
    Array.isArray(earnings.past) &&
    earnings.past.every((date) => typeof date === 'string' && DATE.test(date)) &&
    (earnings.next === null || (typeof earnings.next === 'string' && DATE.test(earnings.next))) &&
    typeof earnings.nextIsEstimate === 'boolean'
  )
}

const keptFrom = (raw: unknown): [string, Kept][] =>
  Object.entries(typeof raw === 'object' && raw !== null ? raw : {}).flatMap(([symbol, value]): [string, Kept][] => {
    const kept = value as Partial<Kept> | null
    return typeof kept?.at === 'number' && isEarnings(kept.earnings) ? [[symbol, { at: kept.at, earnings: kept.earnings }]] : []
  })

const dateOf = (value: unknown): string | null => {
  const stamp = value as { fmt?: unknown; raw?: unknown } | null
  if (typeof stamp?.fmt === 'string' && DATE.test(stamp.fmt)) return stamp.fmt
  return typeof stamp?.raw === 'number' && Number.isFinite(stamp.raw) ? new Date(stamp.raw * 1000).toISOString().slice(0, 10) : null
}

const notNull = <T>(value: T | null): value is T => value !== null

export const parseEarnings = (raw: unknown, now: Date): Earnings => {
  const result = (raw as { quoteSummary?: { result?: unknown[] | null } } | null)?.quoteSummary?.result?.[0] as
    | { calendarEvents?: { earnings?: { earningsDate?: unknown[]; isEarningsDateEstimate?: unknown } }; earnings?: { earningsChart?: { quarterly?: { reportedDate?: unknown }[] } } }
    | undefined
  if (!result) return NO_EARNINGS
  const today = now.toISOString().slice(0, 10)
  const reported = (result.earnings?.earningsChart?.quarterly ?? []).map((quarter) => quarter.reportedDate)
  const past = [...new Set(reported.map(dateOf).filter(notNull))].filter((date) => date <= today).sort()
  const upcomingStamp = result.calendarEvents?.earnings?.earningsDate?.[0]
  const upcoming = dateOf(upcomingStamp)
  const next = upcoming && upcoming >= today && upcoming > (past.at(-1) ?? '') ? upcoming : null
  const stamps = [...reported, ...(next ? [upcomingStamp] : [])]
  const timing = Object.fromEntries(
    stamps.flatMap((stamp) => {
      const date = dateOf(stamp)
      const when = timingOf(stamp)
      return date && when && (past.includes(date) || date === next) ? [[date, when]] : []
    }),
  )
  return { past, next, nextIsEstimate: next !== null && result.calendarEvents?.earnings?.isEarningsDateEstimate === true, timing }
}

const asOf = (earnings: Earnings, now: Date): Earnings => {
  const today = now.toISOString().slice(0, 10)
  if (!earnings.next || earnings.next >= today) return earnings
  const past = earnings.nextIsEstimate ? earnings.past : [...earnings.past, earnings.next]
  return { ...earnings, past, next: null, nextIsEstimate: false }
}

export const createEarningsSource = (deps: { fetch: EarningsFetch; now: () => Date; store?: EarningsStore }): EarningsSource => {
  const kept = new Map<string, Kept>()
  const waiting = new Set<string>()
  const running = new Map<string, Promise<Earnings>>()
  let session: Promise<Session> | null = null
  let saving: Promise<void> = Promise.resolve()
  const loaded = (deps.store?.load() ?? Promise.resolve(null))
    .then((raw) => keptFrom(raw).forEach(([symbol, entry]) => kept.set(symbol, entry)))
    .catch(() => undefined)

  const persist = (): Promise<void> => {
    const store = deps.store
    if (!store) return Promise.resolve()
    saving = saving.then(() => store.save(Object.fromEntries(kept))).catch(() => undefined)
    return saving
  }

  const isFresh = (key: string): boolean => {
    const entry = kept.get(key)
    return entry !== undefined && deps.now().getTime() - entry.at < KEEP_MS
  }

  const openSession = async (): Promise<Session> => {
    const answer = await deps.fetch(COOKIE_URL, { headers: { 'User-Agent': USER_AGENT }, redirect: 'manual' })
    const cookie = answer.headers
      .getSetCookie()
      .map((line) => line.split(';')[0].trim())
      .find((pair) => pair.startsWith('A3='))
    if (!cookie) throw new Error('no_cookie')
    const crumb = (await (await deps.fetch(CRUMB_URL, { headers: { 'User-Agent': USER_AGENT, Cookie: cookie } })).text()).trim()
    if (!CRUMB.test(crumb)) throw new Error('no_crumb')
    return { cookie, crumb }
  }

  const currentSession = (): Promise<Session> => {
    session ??= openSession().catch((error: unknown) => {
      session = null
      throw error
    })
    return session
  }

  const ask = async (symbol: string, retry: boolean): Promise<Earnings> => {
    const { cookie, crumb } = await currentSession()
    const query = new URLSearchParams({ modules: 'calendarEvents,earnings', crumb })
    const answer = await deps.fetch(`${SUMMARY_URL}/${encodeURIComponent(symbol)}?${query}`, {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
    })
    if (REFUSED.includes(answer.status) && retry) {
      session = null
      return ask(symbol, false)
    }
    if (answer.status === 404) return NO_EARNINGS
    if (answer.status !== 200) throw new Error(`status_${answer.status}`)
    return parseEarnings(JSON.parse(await answer.text()), deps.now())
  }

  const refresh = async (key: string, previous: Kept | undefined): Promise<Earnings> => {
    const now = deps.now().getTime()
    try {
      const earnings = await ask(key, true)
      kept.set(key, { at: now, earnings })
      await persist()
      return earnings
    } catch {
      const fallback = previous?.earnings ?? NO_EARNINGS
      kept.set(key, { at: now - KEEP_MS + RETRY_MS, earnings: fallback })
      return fallback
    }
  }

  const get = async (symbol: string): Promise<Earnings> => {
    await loaded
    const key = symbol.toUpperCase()
    const previous = kept.get(key)
    if (previous && deps.now().getTime() - previous.at < KEEP_MS) return asOf(previous.earnings, deps.now())
    const started = running.get(key) ?? refresh(key, previous).finally(() => running.delete(key))
    running.set(key, started)
    return asOf(await started, deps.now())
  }

  const peek = (symbol: string): Earnings | null => {
    const found = kept.get(symbol.toUpperCase())?.earnings
    return found ? asOf(found, deps.now()) : null
  }

  const warm = async (symbols: string[]): Promise<void> => {
    const queue = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].filter((key) => !isFresh(key) && !waiting.has(key))
    queue.forEach((key) => waiting.add(key))
    await loaded
    const work = async (): Promise<void> => {
      const key = queue.shift()
      if (key === undefined) return
      await get(key)
      waiting.delete(key)
      await work()
    }
    await Promise.all(Array.from({ length: WORKERS }, work))
  }

  return { get, peek, warm, pending: () => waiting.size }
}
