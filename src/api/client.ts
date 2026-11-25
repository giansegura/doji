import { type CalendarAnswer, askInBatches } from '../../shared/earningsCalendarBatches'
import { changesSince } from '../../shared/stateChanges'
import type { SymbolMetrics } from '../../shared/symbolMetrics'
import type { AppState, Earnings, History, Quote, SymbolInfo } from '../../shared/types'
import type { SaveResult } from '../state/stateSync'

export type ApiError = Error & { code: string }

const KEEPALIVE_SAFE_BYTES = 60_000

const apiError = (code: string): ApiError => Object.assign(new Error(code), { code })

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof Error && typeof (error as { code?: unknown }).code === 'string'

const send = async (path: string, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(path, init)
  } catch {
    throw apiError('network')
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await send(path, init)
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code = (body as { error?: unknown } | null)?.error
    throw apiError(typeof code === 'string' ? code : 'unavailable')
  }
  return body as T
}

export type TelegramStatus = { connected: boolean; bot: string | null; linked: boolean }

export type TelegramApi = {
  status: () => Promise<TelegramStatus>
  connect: (token: string) => Promise<TelegramStatus>
  link: () => Promise<TelegramStatus>
  test: () => Promise<unknown>
  disconnect: () => Promise<TelegramStatus>
}

export const telegramApi: TelegramApi = {
  status: () => request('/api/telegram'),
  connect: (token) =>
    request('/api/telegram', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }),
  link: () => request('/api/telegram/link', { method: 'POST' }),
  test: () => request('/api/telegram/test', { method: 'POST' }),
  disconnect: () => request('/api/telegram', { method: 'DELETE' }),
}

export const getHistory = (symbol: string): Promise<History> =>
  request(`/api/history?symbol=${encodeURIComponent(symbol)}`)

export const getKeptHistory = (symbol: string): Promise<History> =>
  request(`/api/history?symbol=${encodeURIComponent(symbol)}&cached=1`)

export const searchSymbols = (query: string): Promise<SymbolInfo[]> =>
  request(`/api/search?q=${encodeURIComponent(query)}`)

export const getEarnings = (symbol: string): Promise<Earnings> => request(`/api/earnings?symbol=${encodeURIComponent(symbol)}`)

export type EarningsCalendarAnswer = CalendarAnswer

export const getEarningsCalendar = (symbols: string[]): Promise<EarningsCalendarAnswer> =>
  askInBatches(symbols, (batch) => request(`/api/earnings/calendar?symbols=${batch.map(encodeURIComponent).join(',')}`))

export type WatchMetricsAnswer = { metrics: Record<string, SymbolMetrics>; pending: number }

export const getWatchMetrics = (symbols: string[], withLevel: boolean): Promise<WatchMetricsAnswer> =>
  request(`/api/watchlist/metrics?symbols=${symbols.map(encodeURIComponent).join(',')}${withLevel ? '&level=1' : ''}`)

export const getQuotes = (symbols: string[]): Promise<Quote[]> =>
  request(`/api/quotes?symbols=${symbols.map(encodeURIComponent).join(',')}`)

export const getState = (): Promise<AppState> => request('/api/state')

const saveRequest = (state: AppState, keepalive: boolean, saved: AppState | null): { method: string; body: string } => {
  const whole = JSON.stringify(state)
  if (!keepalive || !saved || new TextEncoder().encode(whole).length <= KEEPALIVE_SAFE_BYTES) {
    return { method: 'PUT', body: whole }
  }
  return { method: 'PATCH', body: JSON.stringify({ rev: state.rev, changes: changesSince(saved, state) }) }
}

export const putState = async (state: AppState, keepalive = false, saved: AppState | null = null): Promise<SaveResult> => {
  try {
    const response = await fetch('/api/state', {
      ...saveRequest(state, keepalive, saved),
      headers: { 'Content-Type': 'application/json' },
      keepalive,
    })
    if (response.status === 409) return { kind: 'conflict' }
    const body = (await response.json().catch(() => null)) as { rev?: unknown } | null
    const rev = body?.rev
    if (!response.ok || typeof rev !== 'number' || !Number.isInteger(rev)) return { kind: 'failed' }
    return { kind: 'saved', rev }
  } catch {
    return { kind: 'failed' }
  }
}
