import type { LiveTick, TickSession } from '../../shared/types'

export type OpenTickStream = (symbols: string[], onTicks: (ticks: LiveTick[]) => void) => () => void

const REOPEN_MS = 30_000
const SESSIONS: TickSession[] = ['pre', 'regular', 'post']

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isTick = (value: unknown): value is LiveTick => {
  const tick = value as Partial<LiveTick> | null
  return (
    typeof tick === 'object' &&
    tick !== null &&
    typeof tick.symbol === 'string' &&
    isNumber(tick.price) &&
    isNumber(tick.change) &&
    isNumber(tick.changePercent) &&
    isNumber(tick.time) &&
    SESSIONS.includes(tick.session as TickSession) &&
    (tick.volume === null || isNumber(tick.volume))
  )
}

const readTicks = (data: unknown): LiveTick[] => {
  try {
    const parsed: unknown = typeof data === 'string' ? JSON.parse(data) : null
    return Array.isArray(parsed) ? parsed.filter(isTick) : []
  } catch {
    return []
  }
}

export const openTickStream: OpenTickStream = (symbols, onTicks) => {
  if (typeof EventSource === 'undefined') return () => undefined
  const url = `/api/stream?symbols=${symbols.map(encodeURIComponent).join(',')}`
  let source: EventSource | null = null
  let reopen: ReturnType<typeof setTimeout> | null = null
  let closed = false

  const open = (): void => {
    reopen = null
    const current = new EventSource(url)
    source = current
    current.onmessage = (event) => {
      const ticks = readTicks(event.data)
      if (ticks.length > 0) onTicks(ticks)
    }
    current.onerror = () => {
      if (closed || current.readyState !== EventSource.CLOSED) return
      reopen = setTimeout(open, REOPEN_MS)
    }
  }

  open()
  return () => {
    closed = true
    source?.close()
    if (reopen !== null) clearTimeout(reopen)
  }
}
