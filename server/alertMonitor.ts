import { type FiredAlert, alertLevels, armedSymbols, createAlertWatcher, latestPrice } from '../shared/alerts'
import { withHistory } from '../shared/alertHistory'
import { afterFiring, canAlert, expiredAlert, withoutAlert } from '../shared/drawings'
import { type IndicatorHit, createIndicatorWatcher, indicatorLabel, sessionDayOf, withLivePrice } from '../shared/indicatorAlerts'
import { tradesEveryDay } from '../shared/symbols'
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

type Outcome = { hits: FiredAlert[]; indicatorHits: IndicatorHit[]; events: AlertEvent[]; today: string }

type Recorded = { state: AppState; events: AlertEvent[] }

const firedOn = (hit: FiredAlert, symbol: string, drawing: Drawing, today: string): boolean =>
  hit.symbol === symbol && hit.drawingId === drawing.id && alertLevels(drawing, today, tradesEveryDay(symbol)).some((level) => level === hit.level)

const hasExpired = (state: AppState, today: string): boolean =>
  Object.values(state.lines).some((drawings) => drawings.some((drawing) => expiredAlert(drawing, today)))

const afterOutcome = (state: AppState, { hits, indicatorHits, events, today }: Outcome): AppState => ({
  ...state,
  alertHistory: withHistory(state.alertHistory, events),
  indicatorAlerts: Object.fromEntries(
    Object.entries(state.indicatorAlerts).map(([symbol, alerts]) => [
      symbol,
      alerts.map((alert) => (indicatorHits.some((hit) => hit.symbol === symbol && hit.alertId === alert.id) ? { ...alert, armed: false } : alert)),
    ]),
  ),
  lines: Object.fromEntries(
    Object.entries(state.lines).map(([symbol, drawings]) => [
      symbol,
      drawings.map((drawing) => {
        if (expiredAlert(drawing, today)) return withoutAlert(drawing)
        return hits.some((hit) => firedOn(hit, symbol, drawing, today)) ? afterFiring(drawing, today) : drawing
      }),
    ]),
  ),
})

const textOf = (state: AppState, hit: FiredAlert): string | null => {
  const drawing = state.lines[hit.symbol]?.find((candidate) => candidate.id === hit.drawingId)
  return drawing && 'text' in drawing && drawing.text ? drawing.text : null
}

const stillArmed = (current: AppState | null, hit: IndicatorHit): boolean =>
  current?.indicatorAlerts[hit.symbol]?.some((alert) => alert.id === hit.alertId && alert.armed) ?? false

const stillSet = (current: AppState, hit: FiredAlert, today: string): boolean =>
  current.lines[hit.symbol]?.some(
    (drawing) => drawing.id === hit.drawingId && canAlert(drawing) && drawing.alert === true && !expiredAlert(drawing, today),
  ) ?? false

// Only the alerts still set in the state they are recorded on, which may have replaced the one they fired on.
const standingIn = (current: AppState, { hits, indicatorHits, events, today }: Outcome): Outcome => {
  const lines = hits.map((hit) => stillSet(current, hit, today))
  const others = indicatorHits.map((hit) => stillArmed(current, hit))
  const standing = [...lines, ...others]
  return {
    today,
    hits: hits.filter((_hit, index) => lines[index]),
    indicatorHits: indicatorHits.filter((_hit, index) => others[index]),
    events: events.filter((_event, index) => standing[index]),
  }
}

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

  const recordOnce = async (result: Outcome): Promise<Recorded | null> => {
    try {
      const fresh = await deps.read()
      const standing = standingIn(fresh, result)
      const next = afterOutcome(fresh, standing)
      const outcome = await deps.save(next, fresh.rev)
      return outcome.ok ? { state: { ...next, rev: outcome.rev }, events: standing.events } : null
    } catch {
      return null
    }
  }

  const record = async (result: Outcome): Promise<Recorded | null> => {
    for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
      const saved = await recordOnce(result)
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
      if (hits.length === 0 && indicatorHits.length === 0 && !hasExpired(before, today)) return []
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
      const recorded = await record({ hits, indicatorHits, events, today })
      if (recorded) stateSaved(recorded.state)
      // An alert that could not be recorded is announced all the same.
      const due = recorded ? recorded.events : events
      if (due.length === 0) return []
      deps.announce(due)
      return due
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
