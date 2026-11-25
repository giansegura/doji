import { askInBatches } from '../shared/earningsCalendarBatches'
import type { AppState, CompanyProfile, Earnings, History, NewsItem, Quote } from '../shared/types'

export type SaveOutcome = 'saved' | 'conflict'

export type DojiApi = {
  getState: () => Promise<AppState>
  saveState: (state: AppState) => Promise<SaveOutcome>
  getHistory: (symbol: string) => Promise<History>
  getQuotes: (symbols: string[]) => Promise<Quote[]>
  getEarningsCalendar: (symbols: string[]) => Promise<{ earnings: Record<string, Earnings>; pending: number }>
  getProfile: (symbol: string) => Promise<CompanyProfile>
  getNews: (symbol: string) => Promise<NewsItem[]>
  getEarnings: (symbol: string) => Promise<Earnings>
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

type ApiDeps = { baseUrl: string; fetch?: FetchLike }

const CONFLICT = 409
const NOT_FOUND = 404

const errorCodeOf = async (response: Response): Promise<string> => {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : 'no detail'
}

export const isMissingSymbol = (error: unknown): boolean =>
  error instanceof Error && (error as { missing?: unknown }).missing === true

export const createDojiApi = ({ baseUrl, fetch = globalThis.fetch }: ApiDeps): DojiApi => {
  const send = async (path: string, init?: RequestInit): Promise<Response> => {
    try {
      return await fetch(`${baseUrl}${path}`, init)
    } catch {
      throw new Error(`doji is not running at ${baseUrl}. Start it with "npm start" in the doji folder.`)
    }
  }

  const read = async <T>(path: string, missing?: string): Promise<T> => {
    const response = await send(path)
    if (response.status === NOT_FOUND && missing) throw Object.assign(new Error(missing), { missing: true })
    if (!response.ok) throw new Error(`doji answered ${response.status} (${await errorCodeOf(response)}).`)
    return (await response.json()) as T
  }

  const saveState = async (state: AppState): Promise<SaveOutcome> => {
    const response = await send('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    if (response.status === CONFLICT) return 'conflict'
    if (!response.ok) throw new Error(`doji answered ${response.status} (${await errorCodeOf(response)}).`)
    return 'saved'
  }

  return {
    getState: () => read('/api/state'),
    saveState,
    getHistory: (symbol) => read(`/api/history?symbol=${encodeURIComponent(symbol)}`, `doji has no data for ${symbol}.`),
    getQuotes: (symbols) => read(`/api/quotes?symbols=${symbols.map(encodeURIComponent).join(',')}`),
    getEarningsCalendar: (symbols) => askInBatches(symbols, (batch) => read(`/api/earnings/calendar?symbols=${batch.map(encodeURIComponent).join(',')}`)),
    getEarnings: (symbol) => read(`/api/earnings?symbol=${encodeURIComponent(symbol)}`),
    getNews: (symbol) => read(`/api/news?symbol=${encodeURIComponent(symbol)}`),
    getProfile: (symbol) => read(`/api/profile?symbol=${encodeURIComponent(symbol)}`, `Yahoo has no company data for ${symbol}.`),
  }
}
