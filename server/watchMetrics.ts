import { type SymbolMetrics, symbolMetrics } from '../shared/symbolMetrics'
import type { History } from '../shared/types'
import type { HistoryCache } from './historyCache'

export type WatchMetricsAnswer = { metrics: Record<string, SymbolMetrics>; pending: number }

export type WatchMetrics = {
  read: (symbols: string[], withLevel: boolean) => Promise<WatchMetricsAnswer>
  settled: () => Promise<void>
}

type Deps = { history: HistoryCache; now?: () => Date; workers?: number }

type Computed = { fetchedAt: string; withLevel: boolean; metrics: SymbolMetrics }

export const STALE_MS = 5 * 60_000
const WORKERS = 2

export const createWatchMetrics = (deps: Deps): WatchMetrics => {
  const nowMs = () => (deps.now ?? (() => new Date()))().getTime()
  const workers = deps.workers ?? WORKERS
  const computed = new Map<string, Computed>()
  const failedAt = new Map<string, number>()
  const queue: string[] = []
  const queued = new Set<string>()
  const idle: (() => void)[] = []
  let running = 0

  const pump = (): void => {
    while (running < workers && queue.length > 0) {
      const symbol = queue.shift() as string
      running += 1
      deps.history
        .get(symbol)
        .then(() => failedAt.delete(symbol))
        .catch(() => failedAt.set(symbol, nowMs()))
        .finally(() => {
          running -= 1
          queued.delete(symbol)
          pump()
          if (running === 0 && queue.length === 0) idle.splice(0).forEach((resolve) => resolve())
        })
    }
  }

  const enqueue = (symbol: string): void => {
    if (queued.has(symbol) || nowMs() - (failedAt.get(symbol) ?? Number.NEGATIVE_INFINITY) < STALE_MS) return
    queued.add(symbol)
    queue.push(symbol)
    pump()
  }

  const metricsOf = (symbol: string, history: History, withLevel: boolean): SymbolMetrics => {
    const known = computed.get(symbol)
    if (known && known.fetchedAt === history.fetchedAt && (known.withLevel || !withLevel)) {
      return withLevel ? known.metrics : { ...known.metrics, level: null }
    }
    const metrics = symbolMetrics(symbol, history.bars, withLevel)
    computed.set(symbol, { fetchedAt: history.fetchedAt, withLevel, metrics })
    return metrics
  }

  const read = async (symbols: string[], withLevel: boolean): Promise<WatchMetricsAnswer> => {
    const metrics: Record<string, SymbolMetrics> = {}
    for (const symbol of symbols) {
      const kept = await deps.history.kept(symbol)
      if (!kept || nowMs() - Date.parse(kept.fetchedAt) > STALE_MS) enqueue(symbol)
      if (kept && kept.bars.length > 0) metrics[symbol] = metricsOf(symbol, kept, withLevel)
    }
    return { metrics, pending: symbols.filter((symbol) => queued.has(symbol)).length }
  }

  const settled = (): Promise<void> =>
    running === 0 && queue.length === 0 ? Promise.resolve() : new Promise((resolve) => idle.push(resolve))

  return { read, settled }
}
