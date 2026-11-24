import { useState } from 'react'
import type { History, Quote } from '../../shared/types'
import { type LivePrice, type SeenTrades, livePriceOf, seeTrade, withSeenRange } from '../domain/liveBar'

export const useLivePrice = (history: History | null, quote: Quote | undefined): LivePrice | null => {
  const [seen, setSeen] = useState<SeenTrades | null>(null)
  const live = livePriceOf(quote)
  const next = seeTrade(seen, history, live)

  if (next !== seen) setSeen(next)

  return withSeenRange(live, next)
}
