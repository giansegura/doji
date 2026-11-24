import { useEffect, useRef, useState } from 'react'
import { type EarningsCalendarAnswer, getEarningsCalendar } from '../api/client'

const NO_EARNINGS: EarningsCalendarAnswer['earnings'] = {}
const POLL_MS = 3000

export const useEarningsCalendar = (
  symbols: string[],
  enabled: boolean,
  fetchCalendar: (symbols: string[]) => Promise<EarningsCalendarAnswer> = getEarningsCalendar,
  pollMs = POLL_MS,
): EarningsCalendarAnswer => {
  const [answer, setAnswer] = useState<(EarningsCalendarAnswer & { key: string }) | null>(null)
  const fetchRef = useRef(fetchCalendar)
  const key = [...new Set(symbols)].sort().join(',')

  useEffect(() => {
    fetchRef.current = fetchCalendar
  }, [fetchCalendar])

  useEffect(() => {
    if (!enabled || !key) return undefined
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const ask = () => {
      fetchRef
        .current(key.split(','))
        .then((next) => {
          if (!active) return
          setAnswer({ ...next, key })
          if (next.pending > 0) timer = setTimeout(ask, pollMs)
        })
        .catch(() => {
          if (active) timer = setTimeout(ask, pollMs)
        })
    }
    ask()
    return () => {
      active = false
      if (timer !== null) clearTimeout(timer)
    }
  }, [enabled, key, pollMs])

  const current = answer?.key === key ? answer : null
  const waiting = enabled && key ? key.split(',').length : 0
  return { earnings: current?.earnings ?? NO_EARNINGS, pending: current ? current.pending : waiting }
}
