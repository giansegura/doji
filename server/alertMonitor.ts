import { type FiredAlert, alertLevels, armedSymbols, createAlertWatcher, latestPrice } from '../shared/alerts'
import { withoutAlert } from '../shared/drawings'
import { type IndicatorHit, createIndicatorWatcher, indicatorLabel, sessionDayOf, withLivePrice } from '../shared/indicatorAlerts'
import type { AlertEvent, AppState, Drawing, LiveTick, Quote } from '../shared/types'
import type { SaveOutcome } from './stateStore'

type MonitorDeps = {
  read: () => Promise<AppState>
  save: (state: AppState, baseRev: number) => Promise<SaveOutcome>
  join: (symbols: string[], send: (ticks: LiveTick[]) => void) => () => void
  quotes: (symbols: string[]) => Promise<Quote[]>
  closes?: (symbol: string) => Promise<DailyCloses | null>
  announce: (alerts: AlertEvent[]) => void
  now: () => Date
  every: (run: () => void, ms: number) => () => void
  newId: () => string
}

export type DailyCloses = { closes: number[]; lastDay: string; timezone?: string; everyDay?: boolean }

export type AlertMonitor = {
  start: () => Promise<void>
  stateSaved: (state: AppState) => void
  check: (prices: Record<string, number>) => Promise<AlertEvent[]>
  settled: () => Promise<void>
  stop: () => void
}

const POLL_MS = 30_000
const SAVE_ATTEMPTS = 3
const CLOSES_KEEP_MS = 10 * 60_000

const twoDigits = (value: number): string => String(value).padStart(2, '0')

const dayOf = (date: Date): string => `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`

const firedOn = (hit: FiredAlert, symbol: string, drawing: Drawing, today: string): boolean =>
  hit.symbol === symbol && hit.drawingId === drawing.id && alertLevels(drawing, today).some((level) => level === hit.level)

const withDisarmed = (state: AppState, today: string, hits: FiredAlert[], indicatorHits: IndicatorHit[] = []): AppState => ({
  ...state,
  indicatorAlerts: Object.fromEntries(
    Object.entries(state.indicatorAlerts).map(([symbol, alerts]) => [
      symbol,
      alerts.map((alert) => (indicatorHits.some((hit) => hit.symbol === symbol && hit.alertId === alert.id) ? { ...alert, armed: false } : alert)),
    ]),
  ),
  lines: Object.fromEntries(
    Object.entries(state.lines).map(([symbol, drawings]) => [
      symbol,
      drawings.map((drawing) => (hits.some((hit) => firedOn(hit, symbol, drawing, today)) ? withoutAlert(drawing) : drawing)),
    ]),
  ),
})

const textOf = (state: AppState, hit: FiredAlert): string | null => {
  const drawing = state.lines[hit.symbol]?.find((candidate) => candidate.id === hit.drawingId)
  return drawing && 'text' in drawing && drawing.text ? drawing.text : null
}

const stillArmed = (current: AppState | null, hit: IndicatorHit): boolean =>
  current?.indicatorAlerts[hit.symbol]?.some((alert) => alert.id === hit.alertId && alert.armed) ?? false

const indicatorSymbols = (state: AppState): string[] =>
  Object.entries(state.indicatorAlerts)
    .filter(([, alerts]) => alerts.some((alert) => alert.armed))
    .map(([symbol]) => symbol)

const watchedSymbols = (state: AppState): string[] => [...new Set([...armedSymbols(state.lines), ...indicatorSymbols(state)])]

export const createAlertMonitor = (deps: MonitorDeps): AlertMonitor => {
  const watcher = createAlertWatcher()
  const indicators = createIndicatorWatcher()
  const kept = new Map<string, { at: number; daily: DailyCloses | null }>()
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

  const dailyOf = async (symbol: string): Promise<DailyCloses | null> => {
    const known = kept.get(symbol)
    const now = deps.now().getTime()
    if (known && now - known.at < CLOSES_KEEP_MS) return known.daily
    const daily = deps.closes ? await deps.closes(symbol).catch(() => null) : null
    kept.set(symbol, { at: now, daily })
    return daily
  }

  const indicatorHitsFor = async (current: AppState, prices: Record<string, number>, today: string): Promise<IndicatorHit[]> => {
    const found: IndicatorHit[] = []
    for (const [symbol, price] of Object.entries(prices)) {
      const alerts = current.indicatorAlerts[symbol] ?? []
      if (alerts.length === 0) continue
      const daily = await dailyOf(symbol)
      if (!daily || daily.closes.length === 0) continue
      const session = sessionDayOf(daily.lastDay, daily.timezone, deps.now().getTime(), daily.everyDay ?? false)
      const live = withLivePrice(daily.closes, daily.lastDay, price, session)
      found.push(...indicators.check(symbol, alerts, live, current.indicators.sma, today))
    }
    return found
  }

  const disarmOnce = async (today: string, hits: FiredAlert[], indicatorHits: IndicatorHit[]): Promise<AppState | null> => {
    try {
      const fresh = await deps.read()
      const next = withDisarmed(fresh, today, hits, indicatorHits)
      const outcome = await deps.save(next, fresh.rev)
      return outcome.ok ? { ...next, rev: outcome.rev } : null
    } catch {
      return null
    }
  }

  const disarm = async (today: string, hits: FiredAlert[], indicatorHits: IndicatorHit[]): Promise<AppState | null> => {
    for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
      const saved = await disarmOnce(today, hits, indicatorHits)
      if (saved) return saved
    }
    return null
  }

  const check = (prices: Record<string, number>): Promise<AlertEvent[]> =>
    enqueue(async () => {
      if (!state || Object.keys(prices).length === 0) return []
      const moment = deps.now()
      const today = dayOf(moment)
      const before = state
      const hits = watcher.check(before.lines, prices, today)
      const indicatorHits = (await indicatorHitsFor(before, prices, today)).filter((hit) => stillArmed(state, hit))
      if (hits.length === 0 && indicatorHits.length === 0) return []
      const saved = await disarm(today, hits, indicatorHits)
      if (saved) stateSaved(saved)
      const lineEvents = hits.map((hit) => ({
        id: deps.newId(),
        symbol: hit.symbol,
        level: hit.level,
        price: hit.price,
        direction: hit.direction,
        at: moment.toISOString(),
        text: textOf(before, hit),
      }))
      const indicatorEvents = indicatorHits.map((hit) => {
        const alert = before.indicatorAlerts[hit.symbol]?.find((candidate) => candidate.id === hit.alertId)
        return {
          id: deps.newId(),
          symbol: hit.symbol,
          level: hit.level,
          price: hit.price,
          direction: hit.direction,
          at: moment.toISOString(),
          text: null,
          label: alert ? indicatorLabel(alert, before.indicators.sma) : 'Indicator alert',
        }
      })
      const events = [...lineEvents, ...indicatorEvents]
      deps.announce(events)
      return events
    })

  const onTicks = (ticks: LiveTick[]): void => {
    const prices = Object.fromEntries(ticks.map((tick) => [tick.symbol, tick.price]))
    check(prices).catch(() => undefined)
  }

  const subscribe = (): void => {
    const symbols = state ? watchedSymbols(state).sort() : []
    const key = symbols.join(',')
    if (key === watched) return
    watched = key
    leave?.()
    leave = symbols.length > 0 ? deps.join(symbols, onTicks) : null
  }

  const poll = (): void => {
    const symbols = state ? watchedSymbols(state) : []
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
