import { SYMBOL_PATTERN } from './symbols'
import type { AlertEvent } from './types'

export const MAX_ALERT_HISTORY = 100

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const toEvent = (raw: unknown): AlertEvent | null => {
  if (!isRecord(raw)) return null
  const { id, symbol, level, price, direction, at, text, label } = raw
  if (typeof id !== 'string' || !id || typeof symbol !== 'string' || !SYMBOL_PATTERN.test(symbol)) return null
  if (!isFiniteNumber(level) || !isFiniteNumber(price) || (direction !== 'up' && direction !== 'down')) return null
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null
  return {
    id,
    symbol,
    level,
    price,
    direction,
    at,
    text: typeof text === 'string' && text ? text : null,
    ...(typeof label === 'string' && label ? { label } : {}),
  }
}

export const toAlertHistory = (raw: unknown): AlertEvent[] =>
  Array.isArray(raw)
    ? raw
        .map(toEvent)
        .filter((event): event is AlertEvent => event !== null)
        .slice(0, MAX_ALERT_HISTORY)
    : []

export const withHistory = (history: AlertEvent[], events: AlertEvent[]): AlertEvent[] => [...[...events].reverse(), ...history].slice(0, MAX_ALERT_HISTORY)
