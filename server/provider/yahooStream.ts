import type { LiveTick } from '../../shared/types'
import { decodeTick } from './pricing'

export type SocketEvent = { data?: unknown }

export type SocketLike = {
  send: (data: string) => void
  close: () => void
  addEventListener: (type: 'open' | 'message' | 'close' | 'error', listener: (event: SocketEvent) => void) => void
}

export type TickStream = { setSymbols: (symbols: string[]) => void }

type StreamDeps = {
  connect: (url: string) => SocketLike
  onTick: (tick: LiveTick) => void
  setTimer: (run: () => void, ms: number) => unknown
  clearTimer: (timer: unknown) => void
}

export const YAHOO_STREAM_URL = 'wss://streamer.finance.yahoo.com/?version=2'
export const MAX_STREAM_SYMBOLS = 300

const HEARTBEAT_MS = 15_000
const FIRST_RETRY_MS = 1_000
const MAX_RETRY_MS = 60_000
const MAX_MESSAGE_CHARS = 8_192

const normalize = (symbols: string[]): string[] =>
  [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].sort().slice(0, MAX_STREAM_SYMBOLS)

const succeeds = (run: () => void): boolean => {
  try {
    run()
    return true
  } catch {
    return false
  }
}

const readTick = (data: unknown): LiveTick | null => {
  if (typeof data !== 'string' || data.length > MAX_MESSAGE_CHARS) return null
  try {
    const message = (JSON.parse(data) as { message?: unknown } | null)?.message
    return typeof message === 'string' ? decodeTick(message) : null
  } catch {
    return null
  }
}

export const createYahooStream = (deps: StreamDeps): TickStream => {
  let wanted: string[] = []
  let following = new Set<string>()
  let subscribed: string[] = []
  let socket: SocketLike | null = null
  let ready = false
  let failures = 0
  let heartbeat: unknown = null
  let retry: unknown = null

  const cancel = (timer: unknown): void => {
    if (timer !== null) deps.clearTimer(timer)
  }

  const release = (): void => {
    cancel(heartbeat)
    heartbeat = null
    const old = socket
    socket = null
    ready = false
    subscribed = []
    if (old) succeeds(() => old.close())
  }

  const retryLater = (): void => {
    retry = deps.setTimer(open, Math.min(FIRST_RETRY_MS * 2 ** failures, MAX_RETRY_MS))
    failures += 1
  }

  const lose = (current: SocketLike): void => {
    if (socket !== current) return
    release()
    if (wanted.length > 0) retryLater()
  }

  const send = (current: SocketLike, message: object): boolean => {
    if (succeeds(() => current.send(JSON.stringify(message)))) return true
    lose(current)
    return false
  }

  const subscribe = (current: SocketLike): void => {
    if (send(current, { subscribe: wanted })) subscribed = wanted
  }

  const beat = (current: SocketLike): void => {
    heartbeat = deps.setTimer(() => {
      if (socket !== current) return
      subscribe(current)
      if (socket === current) beat(current)
    }, HEARTBEAT_MS)
  }

  const listen = (current: SocketLike): void => {
    current.addEventListener('open', () => {
      if (socket !== current) return
      ready = true
      subscribe(current)
      if (socket === current) beat(current)
    })
    current.addEventListener('message', (event) => {
      const tick = socket === current ? readTick(event.data) : null
      if (!tick) return
      failures = 0
      if (following.has(tick.symbol)) deps.onTick(tick)
    })
    current.addEventListener('close', () => lose(current))
    current.addEventListener('error', () => lose(current))
  }

  const open = (): void => {
    retry = null
    try {
      const current = deps.connect(YAHOO_STREAM_URL)
      socket = current
      listen(current)
    } catch {
      retryLater()
    }
  }

  const setSymbols = (symbols: string[]): void => {
    const next = normalize(symbols)
    const changed = next.join(',') !== wanted.join(',')
    wanted = next
    following = new Set(next)
    if (next.length === 0) {
      cancel(retry)
      retry = null
      failures = 0
      release()
      return
    }
    if (!socket && retry === null) {
      open()
      return
    }
    if (!socket || !ready || !changed) return
    const current = socket
    const gone = subscribed.filter((symbol) => !following.has(symbol))
    if (gone.length > 0 && !send(current, { unsubscribe: gone })) return
    subscribe(current)
  }

  return { setSymbols }
}
