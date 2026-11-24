import type { History } from '../../shared/types'
import type { HistoryStore } from './historyStore'

type PrefetchDeps = {
  symbols: string[]
  store: HistoryStore
  fetchKept: (symbol: string) => Promise<History>
  pause: () => Promise<void>
  isActive: () => boolean
}

const keepOne = async (deps: PrefetchDeps, symbol: string): Promise<void> => {
  const history = await deps.fetchKept(symbol).catch(() => null)
  if (history && !deps.store.has(symbol)) deps.store.keep(symbol, history)
}

export const prefetchHistories = async (deps: PrefetchDeps): Promise<void> => {
  for (const symbol of deps.symbols) {
    if (!deps.isActive()) return
    if (deps.store.has(symbol)) continue
    await keepOne(deps, symbol)
    await deps.pause()
  }
}
