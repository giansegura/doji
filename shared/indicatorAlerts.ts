import { sideChange } from './alerts'
import { ema, rsi, sma } from './rsi'
import type { IndicatorAlert, IndicatorAlertKind, SmaConfig } from './types'

export type LiveCloses = { closes: number[]; previous: number }

export type IndicatorHit = { symbol: string; alertId: string; level: number; price: number; direction: 'up' | 'down' }

export type IndicatorWatcher = {
  check: (symbol: string, alerts: IndicatorAlert[], live: LiveCloses, averages: SmaConfig[], today: string) => IndicatorHit[]
}

const RSI_LENGTH = 14

export const withLivePrice = (closes: number[], lastDay: string, price: number, today: string): LiveCloses =>
  lastDay === today
    ? { closes: [...closes.slice(0, -1), price], previous: closes.at(-2) ?? price }
    : { closes: [...closes, price], previous: closes.at(-1) ?? price }

const averageOf = (config: SmaConfig, closes: number[]): number | null =>
  (config.kind === 'ema' ? ema(closes, config.length) : sma(closes, config.length)).at(-1) ?? null

const readingOf = (alert: IndicatorAlert, live: LiveCloses, averages: SmaConfig[]): number | null => {
  const price = live.closes.at(-1) as number
  if (alert.kind === 'rsi') {
    const strength = rsi(live.closes, RSI_LENGTH).at(-1) ?? null
    return strength === null ? null : strength - alert.value
  }
  if (alert.kind === 'average') {
    const config = averages.find((average) => average.id === alert.averageId)
    const level = config ? averageOf(config, live.closes) : null
    return level === null ? null : price - level
  }
  return live.previous > 0 ? Math.abs(((price - live.previous) / live.previous) * 100) - alert.value : null
}

const levelOf = (alert: IndicatorAlert, live: LiveCloses, averages: SmaConfig[]): number => {
  if (alert.kind !== 'average') return alert.value
  const config = averages.find((average) => average.id === alert.averageId)
  return config ? (averageOf(config, live.closes) ?? 0) : 0
}

export const createIndicatorWatcher = (): IndicatorWatcher => {
  const seen = new Map<string, number>()

  const check = (symbol: string, alerts: IndicatorAlert[], live: LiveCloses, averages: SmaConfig[], today: string): IndicatorHit[] =>
    alerts.flatMap((alert) => {
      const key = `${symbol}:${alert.id}:${alert.kind === 'move' ? today : ''}`
      const reading = readingOf(alert, live, averages)
      const before = seen.get(key)
      if (reading === null) return []
      seen.set(key, reading)
      if (!alert.armed || before === undefined) return []
      const price = live.closes.at(-1) as number
      if (alert.kind === 'move') {
        if (!(before < 0 && reading >= 0)) return []
        return [{ symbol, alertId: alert.id, level: alert.value, price, direction: price >= live.previous ? 'up' : 'down' }]
      }
      const direction = sideChange(before, reading)
      return direction ? [{ symbol, alertId: alert.id, level: levelOf(alert, live, averages), price, direction }] : []
    })

  return { check }
}

const averageName = (config: SmaConfig): string => `${config.kind === 'ema' ? 'EMA' : 'SMA'} ${config.length}`

export const indicatorLabel = (alert: IndicatorAlert, averages: SmaConfig[]): string => {
  if (alert.kind === 'rsi') return `RSI 14 crosses ${alert.value}`
  if (alert.kind === 'move') return `Day move beyond ${alert.value}%`
  const config = averages.find((average) => average.id === alert.averageId)
  return config ? `Price crosses ${averageName(config)}` : 'Price crosses a removed average'
}

const KINDS: IndicatorAlertKind[] = ['rsi', 'average', 'move']

const toAlert = (raw: unknown): IndicatorAlert[] => {
  const item = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const kind = KINDS.find((option) => option === item.kind)
  if (typeof item.id !== 'string' || !item.id || !kind || typeof item.value !== 'number' || !Number.isFinite(item.value)) return []
  const averageId = kind === 'average' && typeof item.averageId === 'string' ? { averageId: item.averageId } : {}
  return [{ id: item.id, kind, value: item.value, ...averageId, armed: item.armed === true }]
}

export const toIndicatorAlerts = (raw: unknown): Record<string, IndicatorAlert[]> =>
  Object.fromEntries(
    Object.entries(raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {})
      .map(([symbol, list]): [string, IndicatorAlert[]] => [symbol, Array.isArray(list) ? list.flatMap(toAlert) : []])
      .filter(([, list]) => list.length > 0),
  )
