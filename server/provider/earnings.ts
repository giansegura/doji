import type { Earnings } from '../../shared/types'

export type EarningsFetch = (
  url: string,
  init: { headers: Record<string, string>; redirect?: 'manual' },
) => Promise<{ status: number; headers: { getSetCookie: () => string[] }; text: () => Promise<string> }>

export type EarningsSource = { get: (symbol: string) => Promise<Earnings> }

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
  const past = [...new Set((result.earnings?.earningsChart?.quarterly ?? []).map((quarter) => dateOf(quarter.reportedDate)).filter(notNull))]
    .filter((date) => date <= today)
    .sort()
  const upcoming = dateOf(result.calendarEvents?.earnings?.earningsDate?.[0])
  const next = upcoming && upcoming >= today && upcoming > (past.at(-1) ?? '') ? upcoming : null
  return { past, next, nextIsEstimate: next !== null && result.calendarEvents?.earnings?.isEarningsDateEstimate === true }
}

export const createEarningsSource = (deps: { fetch: EarningsFetch; now: () => Date }): EarningsSource => {
  const kept = new Map<string, Kept>()
  let session: Promise<Session> | null = null

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

  const get = async (symbol: string): Promise<Earnings> => {
    const key = symbol.toUpperCase()
    const now = deps.now().getTime()
    const previous = kept.get(key)
    if (previous && now - previous.at < KEEP_MS) return previous.earnings
    try {
      const earnings = await ask(key, true)
      kept.set(key, { at: now, earnings })
      return earnings
    } catch {
      const fallback = previous?.earnings ?? NO_EARNINGS
      kept.set(key, { at: now - KEEP_MS + RETRY_MS, earnings: fallback })
      return fallback
    }
  }

  return { get }
}
