import { type FiredAlert, alertLevels, armedSymbols, createAlertWatcher, latestPrice } from '../shared/alerts'
import type { AlertEvent, AppState, Drawing, LiveTick, Quote } from '../shared/types'
import type { SaveOutcome } from './stateStore'

type MonitorDeps = {
  read: () => Promise<AppState>
  save: (state: AppState, baseRev: number) => Promise<SaveOutcome>
  join: (symbols: string[], send: (ticks: LiveTick[]) => void) => () => void
  quotes: (symbols: string[]) => Promise<Quote[]>
  announce: (alerts: AlertEvent[]) => void
  now: () => Date
  every: (run: () => void, ms: number) => () => void
  newId: () => string
}

export type AlertMonitor = {
  start: () => Promise<void>
  stateSaved: (state: AppState) => void
  check: (prices: Record<string, number>) => Promise<AlertEvent[]>
  settled: () => Promise<void>
  stop: () => void
}

const POLL_MS = 30_000
const SAVE_ATTEMPTS = 3

const twoDigits = (value: number): string => String(value).padStart(2, '0')

const dayOf = (date: Date): string => `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`

const quiet = (drawing: Drawing): Drawing => {
  if (drawing.kind === 'channel' || drawing.kind === 'rect') return drawing
  const { alert: _alert, ...rest } = drawing
  return rest as Drawing
}

const firedOn = (hit: FiredAlert, symbol: string, drawing: Drawing, today: string): boolean =>
  hit.symbol === symbol && hit.drawingId === drawing.id && alertLevels(drawing, today).some((level) => level === hit.level)

const withDisarmed = (state: AppState, hits: FiredAlert[], today: string): AppState => ({
  ...state,
  lines: Object.fromEntries(
    Object.entries(state.lines).map(([symbol, drawings]) => [
      symbol,
      drawings.map((drawing) => (hits.some((hit) => firedOn(hit, symbol, drawing, today)) ? quiet(drawing) : drawing)),
    ]),
  ),
})

const textOf = (state: AppState, hit: FiredAlert): string | null => {
  const drawing = state.lines[hit.symbol]?.find((candidate) => candidate.id === hit.drawingId)
  return drawing && 'text' in drawing && drawing.text ? drawing.text : null
}

export const createAlertMonitor = (deps: MonitorDeps): AlertMonitor => {
  const watcher = createAlertWatcher()
  let state: AppState | null = null
  let watched = ''
  let leave: (() => void) | null = null
  let stopPolling: (() => void) | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work)
    queue = next.catch(() => undefined)
    return next
  }

  const disarmOnce = async (hits: FiredAlert[], today: string): Promise<AppState | null> => {
    try {
      const fresh = await deps.read()
      const next = withDisarmed(fresh, hits, today)
      const outcome = await deps.save(next, fresh.rev)
      return outcome.ok ? { ...next, rev: outcome.rev } : null
    } catch {
      return null
    }
  }

  const disarm = async (hits: FiredAlert[], today: string): Promise<AppState | null> => {
    for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
      const saved = await disarmOnce(hits, today)
      if (saved) return saved
    }
    return null
  }

  const check = (prices: Record<string, number>): Promise<AlertEvent[]> =>
    enqueue(async () => {
      if (!state || Object.keys(prices).length === 0) return []
      const moment = deps.now()
      const today = dayOf(moment)
      const hits = watcher.check(state.lines, prices, today)
      if (hits.length === 0) return []
      const before = state
      const saved = await disarm(hits, today)
      if (saved) stateSaved(saved)
      const events = hits.map((hit) => ({
        id: deps.newId(),
        symbol: hit.symbol,
        level: hit.level,
        price: hit.price,
        direction: hit.direction,
        at: moment.toISOString(),
        text: textOf(before, hit),
      }))
      deps.announce(events)
      return events
    })

  const onTicks = (ticks: LiveTick[]): void => {
    const prices = Object.fromEntries(ticks.map((tick) => [tick.symbol, tick.price]))
    check(prices).catch(() => undefined)
  }

  const subscribe = (): void => {
    const symbols = state ? armedSymbols(state.lines).sort() : []
    const key = symbols.join(',')
    if (key === watched) return
    watched = key
    leave?.()
    leave = symbols.length > 0 ? deps.join(symbols, onTicks) : null
  }

  const poll = (): void => {
    const symbols = state ? armedSymbols(state.lines) : []
    if (symbols.length === 0) return
    enqueue(async () => {
      const quotes = await deps.quotes(symbols)
      return Object.fromEntries(quotes.map((quote) => [quote.symbol, latestPrice(quote)]))
    })
      .then((prices) => check(prices))
      .catch(() => undefined)
  }

  const stateSaved = (next: AppState): void => {
    state = next
    subscribe()
  }

  const start = async (): Promise<void> => {
    stateSaved(await deps.read())
    stopPolling = deps.every(poll, POLL_MS)
  }

  const stop = (): void => {
    leave?.()
    leave = null
    stopPolling?.()
    stopPolling = null
  }

  const settled = async (): Promise<void> => {
    let current = queue
    await current
    while (current !== queue) {
      current = queue
      await current
    }
  }

  return { start, stateSaved, check, settled, stop }
}
