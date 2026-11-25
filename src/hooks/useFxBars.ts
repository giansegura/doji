import { useEffect, useRef, useState } from 'react'
import type { Bar, History } from '../../shared/types'
import { getHistory } from '../api/client'

type Loaded = { pair: string; bars: Bar[] }

export const useFxBars = (pair: string | null, fetchHistory: (symbol: string) => Promise<History> = getHistory): Bar[] | null => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const fetchRef = useRef(fetchHistory)

  useEffect(() => {
    fetchRef.current = fetchHistory
  }, [fetchHistory])

  useEffect(() => {
    if (!pair) return undefined
    let active = true
    fetchRef
      .current(pair)
      .then((history) => {
        if (active) setLoaded({ pair, bars: history.bars })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [pair])

  return pair && loaded?.pair === pair ? loaded.bars : null
}
