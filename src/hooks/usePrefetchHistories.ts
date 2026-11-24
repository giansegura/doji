import { useEffect } from 'react'
import type { History } from '../../shared/types'
import { getKeptHistory } from '../api/client'
import { type HistoryStore, sharedHistoryStore } from './historyStore'
import { prefetchHistories } from './prefetchHistories'

const START_DELAY_MS = 600
const PAUSE_MS = 100
const MAX_SYMBOLS = 24

const pause = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, PAUSE_MS))

export const usePrefetchHistories = (
  symbols: string[],
  fetchKept: (symbol: string) => Promise<History> = getKeptHistory,
  store: HistoryStore = sharedHistoryStore,
) => {
  const key = symbols.slice(0, MAX_SYMBOLS).join(',')

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      prefetchHistories({ symbols: key ? key.split(',') : [], store, fetchKept, pause, isActive: () => active })
    }, START_DELAY_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [key, fetchKept, store])
}
