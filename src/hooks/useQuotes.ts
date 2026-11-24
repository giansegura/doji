import { useEffect, useRef, useState } from 'react'
import type { Quote } from '../../shared/types'
import { getQuotes } from '../api/client'
import { type OpenTickStream, openTickStream } from '../api/tickStream'
import { EMPTY_BOOK, type QuoteBook, applyPolled, applyTicks, isLive, quietSymbols } from '../domain/liveQuotes'

type Quotes = { quotes: Record<string, Quote>; live: boolean }

const REFRESH_MS = 15_000
const FULL_REFRESH_EVERY = 4

export const useQuotes = (
  symbols: string[],
  fetchQuotes: (symbols: string[]) => Promise<Quote[]> = getQuotes,
  background = false,
  openStream: OpenTickStream = openTickStream,
): Quotes => {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [live, setLive] = useState(false)
  const bookRef = useRef<QuoteBook>(EMPTY_BOOK)
  const fetchRef = useRef(fetchQuotes)
  const openRef = useRef(openStream)
  const key = [...symbols].sort().join(',')

  useEffect(() => {
    fetchRef.current = fetchQuotes
    openRef.current = openStream
  }, [fetchQuotes, openStream])

  useEffect(() => {
    if (!key) return undefined
    let active = true
    let issued = 0
    let applied = 0
    let cycle = 0
    let closeStream: (() => void) | null = null
    const list = key.split(',')
    const isWanted = (): boolean => background || document.visibilityState === 'visible'

    const keep = (book: QuoteBook): void => {
      bookRef.current = book
      setQuotes(book.quotes)
      setLive(isLive(book, list, Date.now()))
    }

    const load = (wanted: string[]): void => {
      if (wanted.length === 0) return
      issued += 1
      const order = issued
      const sentAt = Date.now()
      fetchRef
        .current(wanted)
        .then((received) => {
          if (!active || order < applied) return
          applied = order
          keep(applyPolled(bookRef.current, received, sentAt))
        })
        .catch(() => undefined)
    }

    const syncStream = (): void => {
      if (isWanted() && !closeStream) {
        closeStream = openRef.current(list, (ticks) => {
          if (active) keep(applyTicks(bookRef.current, ticks, Date.now()))
        })
        return
      }
      if (isWanted() || !closeStream) return
      closeStream()
      closeStream = null
    }

    load(list)
    syncStream()
    document.addEventListener('visibilitychange', syncStream)
    const timer = setInterval(() => {
      const now = Date.now()
      setLive(isLive(bookRef.current, list, now))
      if (!isWanted()) return
      cycle += 1
      load(cycle % FULL_REFRESH_EVERY === 0 ? list : quietSymbols(bookRef.current, list, now))
    }, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', syncStream)
      closeStream?.()
    }
  }, [key, background])

  return { quotes, live }
}
