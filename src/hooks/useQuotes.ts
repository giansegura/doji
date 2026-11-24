import { useEffect, useRef, useState } from 'react'
import type { Quote } from '../../shared/types'
import { getQuotes } from '../api/client'

const REFRESH_MS = 15_000

export const useQuotes = (
  symbols: string[],
  fetchQuotes: (symbols: string[]) => Promise<Quote[]> = getQuotes,
  background = false,
): Record<string, Quote> => {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const fetchRef = useRef(fetchQuotes)
  const key = [...symbols].sort().join(',')

  useEffect(() => {
    fetchRef.current = fetchQuotes
  }, [fetchQuotes])

  useEffect(() => {
    if (!key) return undefined
    let active = true
    const list = key.split(',')
    const load = () =>
      fetchRef
        .current(list)
        .then((received) => {
          if (!active) return
          setQuotes((current) => ({ ...current, ...Object.fromEntries(received.map((quote) => [quote.symbol, quote])) }))
        })
        .catch(() => undefined)
    load()
    const timer = setInterval(() => {
      if (background || document.visibilityState === 'visible') load()
    }, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [key, background])

  return quotes
}
