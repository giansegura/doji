import type { History, SymbolInfo } from '../../shared/types'

type Load = { status: 'loading' | 'ready' | 'error'; history: History | null; errorCode: string | null }

export type PendingDecision = { type: 'wait' } | { type: 'drop' } | { type: 'add'; info: SymbolInfo }

export const resolvePendingAdd = (pending: string | null, load: Load): PendingDecision => {
  if (!pending || load.status === 'loading') return { type: 'wait' }
  if (load.status === 'error') return { type: 'drop' }
  if (!load.history || load.history.info.symbol.toUpperCase() !== pending.toUpperCase()) return { type: 'wait' }
  if (load.history.bars.length === 0) return { type: 'drop' }
  return { type: 'add', info: load.history.info }
}
