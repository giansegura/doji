import { useCallback, useEffect, useRef, useState } from 'react'
import type { History } from '../../shared/types'
import { getHistory, isApiError } from '../api/client'

type HistoryState = {
  symbol: string
  status: 'loading' | 'ready' | 'error'
  history: History | null
  errorCode: string | null
}

const REFRESH_MS = 15_000

const loading = (symbol: string): HistoryState => ({ symbol, status: 'loading', history: null, errorCode: null })

export const useHistory = (symbol: string, fetchHistory: (symbol: string) => Promise<History> = getHistory) => {
  const [state, setState] = useState<HistoryState>(() => loading(symbol))
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
          if (active) setState({ symbol, status: 'ready', history, errorCode: null })
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
    keepOrReplace(loading(symbol))
    load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !missing) load()
    }, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [symbol, attempt])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  const current = state.symbol === symbol ? state : loading(symbol)

  return { status: current.status, history: current.history, errorCode: current.errorCode, retry }
}
