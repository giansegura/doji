import { useEffect, useRef, useState } from 'react'
import type { Bar, History } from '../../shared/types'
import { getHistory } from '../api/client'

type Loaded = { pair: string; bars: Bar[] | null; failed: boolean }

export type FxRates = { bars: Bar[] | null; failed: boolean }

const REFRESH_MS = 60_000
const NONE: FxRates = { bars: null, failed: false }

export const useFxBars = (
  pair: string | null,
  fetchHistory: (symbol: string) => Promise<History> = getHistory,
  refreshMs = REFRESH_MS,
): FxRates => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const fetchRef = useRef(fetchHistory)

  useEffect(() => {
    fetchRef.current = fetchHistory
  }, [fetchHistory])

  useEffect(() => {
    if (!pair) return undefined
    let active = true
    const load = () =>
      fetchRef
        .current(pair)
        .then((history) => {
          if (active) setLoaded({ pair, bars: history.bars, failed: false })
        })
        .catch(() => {
          if (active) setLoaded((current) => (current?.pair === pair && current.bars ? current : { pair, bars: null, failed: true }))
        })
    const loadIfSeen = () => {
      if (document.visibilityState === 'visible') load()
    }
    load()
    const timer = setInterval(loadIfSeen, refreshMs)
    document.addEventListener('visibilitychange', loadIfSeen)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', loadIfSeen)
    }
  }, [pair, refreshMs])

  return pair && loaded?.pair === pair ? { bars: loaded.bars, failed: loaded.failed } : NONE
}
