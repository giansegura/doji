import type { LiveTick } from '../shared/types'

export type LiveHub = {
  join: (symbols: string[], send: (ticks: LiveTick[]) => void) => () => void
  push: (tick: LiveTick) => void
  size: () => number
}

type Client = { symbols: Set<string>; send: (ticks: LiveTick[]) => void }

type HubDeps = {
  now: () => number
  watch: (symbols: string[]) => void
  setTimer: (run: () => void, ms: number) => unknown
  clearTimer: (timer: unknown) => void
}

export const FLUSH_MS = 250
export const LINGER_MS = 10_000

const MAX_AHEAD_MS = 3_600_000

const isTick = (tick: LiveTick | undefined): tick is LiveTick => tick !== undefined

export const createLiveHub = (deps: HubDeps): LiveHub => {
  const clients = new Set<Client>()
  const latest = new Map<string, LiveTick>()
  const pending = new Map<string, LiveTick>()
  let watching = new Set<string>()
  let flushTimer: unknown = null
  let lingerTimer: unknown = null

  const stopLinger = (): void => {
    if (lingerTimer !== null) deps.clearTimer(lingerTimer)
    lingerTimer = null
  }

  const sync = (): void => {
    const symbols = [...new Set([...clients].flatMap((client) => [...client.symbols]))].sort()
    if (symbols.join(',') === [...watching].join(',')) return
    watching = new Set(symbols)
    ;[...latest.keys()].filter((symbol) => !watching.has(symbol)).forEach((symbol) => latest.delete(symbol))
    deps.watch(symbols)
  }

  const drop = (client: Client): void => {
    if (!clients.delete(client)) return
    stopLinger()
    lingerTimer = deps.setTimer(() => {
      lingerTimer = null
      sync()
    }, LINGER_MS)
  }

  const deliver = (client: Client, ticks: LiveTick[]): void => {
    try {
      client.send(ticks)
    } catch {
      drop(client)
    }
  }

  const flush = (): void => {
    flushTimer = null
    const ticks = [...pending.values()]
    pending.clear()
    ;[...clients].forEach((client) => {
      const mine = ticks.filter((tick) => client.symbols.has(tick.symbol))
      if (mine.length > 0) deliver(client, mine)
    })
  }

  const join = (symbols: string[], send: (ticks: LiveTick[]) => void): (() => void) => {
    const client: Client = { symbols: new Set(symbols.map((symbol) => symbol.toUpperCase())), send }
    clients.add(client)
    stopLinger()
    sync()
    const known = [...client.symbols].map((symbol) => latest.get(symbol)).filter(isTick)
    if (known.length > 0) deliver(client, known)
    return () => drop(client)
  }

  const push = (tick: LiveTick): void => {
    const last = latest.get(tick.symbol)
    if (!watching.has(tick.symbol) || tick.time > deps.now() + MAX_AHEAD_MS || (last && tick.time < last.time)) return
    latest.set(tick.symbol, tick)
    pending.set(tick.symbol, tick)
    if (flushTimer === null) flushTimer = deps.setTimer(flush, FLUSH_MS)
  }

  return { join, push, size: () => clients.size }
}
