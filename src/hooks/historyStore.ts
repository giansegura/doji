import type { History } from '../../shared/types'

export type HistoryStore = {
  get: (symbol: string) => History | null
  has: (symbol: string) => boolean
  keep: (symbol: string, history: History) => void
}

const DEFAULT_LIMIT = 30

export const createHistoryStore = (limit: number = DEFAULT_LIMIT): HistoryStore => {
  const kept = new Map<string, History>()

  const keep = (symbol: string, history: History): void => {
    const key = symbol.toUpperCase()
    kept.delete(key)
    kept.set(key, history)
    const oldest = kept.keys().next().value
    if (kept.size > limit && oldest !== undefined) kept.delete(oldest)
  }

  return {
    get: (symbol) => kept.get(symbol.toUpperCase()) ?? null,
    has: (symbol) => kept.has(symbol.toUpperCase()),
    keep,
  }
}

export const sharedHistoryStore = createHistoryStore()
