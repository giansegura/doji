import { useCallback, useEffect, useRef, useState } from 'react'
import type { History } from '../../shared/types'
import { getHistory, isApiError } from '../api/client'
import { type HistoryStore, sharedHistoryStore } from './historyStore'

type HistoryState = {
  symbol: string
  status: 'loading' | 'ready' | 'error'
  history: History | null
  errorCode: string | null
}

const REFRESH_MS = 15_000

const loading = (symbol: string): HistoryState => ({ symbol, status: 'loading', history: null, errorCode: null })

const ready = (symbol: string, history: History): HistoryState => ({ symbol, status: 'ready', history, errorCode: null })

const startFor = (symbol: string, store: HistoryStore): HistoryState => {
  const kept = store.get(symbol)
  return kept ? ready(symbol, kept) : loading(symbol)
}

export const useHistory = (
  symbol: string,
  fetchHistory: (symbol: string) => Promise<History> = getHistory,
  store: HistoryStore = sharedHistoryStore,
) => {
  const [state, setState] = useState<HistoryState>(() => startFor(symbol, store))
  const [attempt, setAttempt] = useState(0)
  const fetchRef = useRef(fetchHistory)

  useEffect(() => {
    fetchRef.current = fetchHistory
  }, [fetchHistory])

  useEffect(() => {
    let active = true
    let missing = false
    const keepOrReplace = (next: HistoryState) =>
      setState((current) => (current.symbol === symbol && current.history ? current : next))
    const load = () =>
      fetchRef
        .current(symbol)
        .then((history) => {
          store.keep(symbol, history)
          if (active) setState(ready(symbol, history))
        })
        .catch((error: unknown) => {
          if (!active) return
          missing = isApiError(error) && error.code === 'not_found'
          keepOrReplace({
            symbol,
            status: 'error',
            history: null,
            errorCode: isApiError(error) ? error.code : 'unavailable',
          })
        })
    keepOrReplace(startFor(symbol, store))
    load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !missing) load()
    }, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [symbol, attempt, store])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  const current = state.symbol === symbol ? state : startFor(symbol, store)

  return { status: current.status, history: current.history, errorCode: current.errorCode, retry }
}
