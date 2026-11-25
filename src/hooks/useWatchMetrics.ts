import { useEffect, useRef, useState } from 'react'
import type { SymbolMetrics } from '../../shared/symbolMetrics'
import { type WatchMetricsAnswer, getWatchMetrics } from '../api/client'

type Delays = { soon: number; later: number }

type MetricsWanted = { enabled: boolean; withLevel: boolean; everyList?: boolean }

const DELAYS: Delays = { soon: 3000, later: 5 * 60_000 }
const NO_METRICS: Record<string, SymbolMetrics> = {}

export const useWatchMetrics = (
  symbols: string[],
  { enabled, withLevel, everyList = false }: MetricsWanted,
  fetchMetrics: (symbols: string[], withLevel: boolean, everyList?: boolean) => Promise<WatchMetricsAnswer> = getWatchMetrics,
  delays: Delays = DELAYS,
): Record<string, SymbolMetrics> => {
  const [answer, setAnswer] = useState<{ key: string; metrics: Record<string, SymbolMetrics> } | null>(null)
  const fetchRef = useRef(fetchMetrics)
  const key = [...new Set(symbols)].sort().join(',')
  const asked = `${key}|${withLevel}|${everyList}`

  useEffect(() => {
    fetchRef.current = fetchMetrics
  }, [fetchMetrics])

  useEffect(() => {
    if (!enabled || !key) return undefined
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const ask = () => {
      fetchRef
        .current(key.split(','), withLevel, everyList)
        .then((next) => {
          if (!active) return
          setAnswer({ key: asked, metrics: next.metrics })
          timer = setTimeout(ask, next.pending > 0 ? delays.soon : delays.later)
        })
        .catch(() => {
          if (active) timer = setTimeout(ask, delays.soon)
        })
    }
    ask()
    return () => {
      active = false
      if (timer !== null) clearTimeout(timer)
    }
  }, [enabled, key, withLevel, everyList, asked, delays.soon, delays.later])

  return enabled && answer?.key === asked ? answer.metrics : NO_METRICS
}
