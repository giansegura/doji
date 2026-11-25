import { type SymbolMetrics, symbolMetrics } from '../shared/symbolMetrics'
import type { History } from '../shared/types'
import type { HistoryCache } from './historyCache'

export type WatchMetricsAnswer = { metrics: Record<string, SymbolMetrics>; pending: number }

export type WatchMetrics = {
  read: (symbols: string[], withLevel: boolean) => Promise<WatchMetricsAnswer>
  settled: () => Promise<void>
}

type Deps = { history: HistoryCache; now?: () => Date; workers?: number }

type Known = { metrics: SymbolMetrics; fetchedAt: number; withLevel: boolean }

export const STALE_MS = 5 * 60_000
export const STALE_MANY_MS = 30 * 60_000
export const MANY_SYMBOLS = 60
const WORKERS = 2

export const createWatchMetrics = (deps: Deps): WatchMetrics => {
  const nowMs = () => (deps.now ?? (() => new Date()))().getTime()
  const workers = deps.workers ?? WORKERS
  const known = new Map<string, Known>()
  const triedAt = new Map<string, number>()
  const levelWanted = new Set<string>()
  const queue: string[] = []
  const queued = new Set<string>()
  const idle: (() => void)[] = []
  let running = 0

  const remember = (symbol: string, history: History, withLevel: boolean): Known => {
    const entry = { metrics: symbolMetrics(symbol, history.bars, withLevel), fetchedAt: Date.parse(history.fetchedAt), withLevel }
    known.set(symbol, entry)
    return entry
  }

  const pump = (): void => {
    while (running < workers && queue.length > 0) {
      const symbol = queue.shift() as string
      running += 1
      deps.history
        .get(symbol, false)
        .then((fresh) => {
          if (fresh.bars.length > 0) remember(symbol, fresh, levelWanted.has(symbol))
        })
        .catch(() => undefined)
        .finally(() => {
          triedAt.set(symbol, nowMs())
          running -= 1
          queued.delete(symbol)
          pump()
          if (running === 0 && queue.length === 0) idle.splice(0).forEach((resolve) => resolve())
        })
    }
  }

  const enqueue = (symbol: string): void => {
    if (queued.has(symbol)) return
    queued.add(symbol)
    queue.push(symbol)
    pump()
  }

  const read = async (symbols: string[], withLevel: boolean): Promise<WatchMetricsAnswer> => {
    const staleMs = symbols.length > MANY_SYMBOLS ? STALE_MANY_MS : STALE_MS
    const metrics: Record<string, SymbolMetrics> = {}
    for (const symbol of symbols) {
      if (withLevel) levelWanted.add(symbol)
      let entry = known.get(symbol) ?? null
      if (!entry || (withLevel && !entry.withLevel)) {
        const kept = await deps.history.kept(symbol)
        entry = kept && kept.bars.length > 0 ? remember(symbol, kept, withLevel || (entry?.withLevel ?? false)) : entry
      }
      const checked = Math.max(entry?.fetchedAt ?? Number.NEGATIVE_INFINITY, triedAt.get(symbol) ?? Number.NEGATIVE_INFINITY)
      if (nowMs() - checked > staleMs) enqueue(symbol)
      if (entry) metrics[symbol] = withLevel ? entry.metrics : { ...entry.metrics, level: null }
    }
    return { metrics, pending: symbols.filter((symbol) => queued.has(symbol)).length }
  }

  const settled = (): Promise<void> =>
    running === 0 && queue.length === 0 ? Promise.resolve() : new Promise((resolve) => idle.push(resolve))

  return { read, settled }
}
