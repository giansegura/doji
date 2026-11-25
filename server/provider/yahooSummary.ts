export type SummaryFetch = (
  url: string,
  init: { headers: Record<string, string>; redirect?: 'manual' },
) => Promise<{ status: number; headers: { getSetCookie: () => string[] }; text: () => Promise<string> }>

export type YahooSummary = { ask: (symbol: string, modules: string) => Promise<unknown | null> }

type Session = { cookie: string; crumb: string }

const COOKIE_URL = 'https://fc.yahoo.com'
const CRUMB_URL = 'https://query2.finance.yahoo.com/v1/test/getcrumb'
const SUMMARY_URL = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary'
const USER_AGENT = 'Mozilla/5.0'
const REFUSED = [401, 403]
const CRUMB = /^[\w./-]{1,64}$/

export const createYahooSummary = (deps: { fetch: SummaryFetch }): YahooSummary => {
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

  const ask = async (symbol: string, modules: string, retry = true): Promise<unknown | null> => {
    const used = currentSession()
    const { cookie, crumb } = await used
    const query = new URLSearchParams({ modules, crumb })
    const answer = await deps.fetch(`${SUMMARY_URL}/${encodeURIComponent(symbol)}?${query}`, {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
    })
    if (REFUSED.includes(answer.status) && retry) {
      if (session === used) session = null
      return ask(symbol, modules, false)
    }
    if (answer.status === 404) return null
    if (answer.status !== 200) throw new Error(`status_${answer.status}`)
    return JSON.parse(await answer.text())
  }

  return { ask: (symbol, modules) => ask(symbol, modules) }
}
