import { useEffect, useRef, useState } from 'react'
import type { Earnings } from '../../shared/types'
import { getEarnings } from '../api/client'

type Loaded = { symbol: string; earnings: Earnings }

export const useEarnings = (symbol: string, fetchEarnings: (symbol: string) => Promise<Earnings> = getEarnings): Earnings | null => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const fetchRef = useRef(fetchEarnings)

  useEffect(() => {
    fetchRef.current = fetchEarnings
  }, [fetchEarnings])

  useEffect(() => {
    let active = true
    fetchRef
      .current(symbol)
      .then((earnings) => {
        if (active) setLoaded({ symbol, earnings })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [symbol])

  return loaded?.symbol === symbol ? loaded.earnings : null
}
