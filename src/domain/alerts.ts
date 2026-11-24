import { weekdaysBetween } from '../../shared/dates'
import type { Drawing, Quote, TrendLine } from '../../shared/types'

export type Direction = 'up' | 'down'

export type FiredAlert = { symbol: string; drawingId: string; level: number; price: number; direction: Direction }

export type AlertWatcher = {
  check: (lines: Record<string, Drawing[]>, prices: Record<string, number>, today: string) => FiredAlert[]
  symbols: (lines: Record<string, Drawing[]>) => string[]
}

const isArmed = (drawing: Drawing): boolean =>
  drawing.pane === 'price' && (drawing.kind === undefined || drawing.kind === 'trend' || drawing.kind === 'hline') && drawing.alert === true

const trendLevel = (line: TrendLine, today: string): number | null => {
  const [left, right] = line.p1.date <= line.p2.date ? [line.p1, line.p2] : [line.p2, line.p1]
  const span = weekdaysBetween(left.date, right.date)
  if (today < left.date || (today > right.date && !line.extendRight)) return null
  if (span === 0) return right.value
  return left.value + ((right.value - left.value) * weekdaysBetween(left.date, today)) / span
}

export const alertLevel = (drawing: Drawing, today: string): number | null => {
  if (drawing.kind === 'hline') return drawing.value
  if (drawing.kind === 'channel' || drawing.kind === 'rect') return null
  return trendLevel(drawing, today)
}

export const sideChange = (before: number, after: number): Direction | null => {
  if (before < 0 && after >= 0) return 'up'
  if (before > 0 && after <= 0) return 'down'
  return null
}

export const latestPrice = (quote: Quote): number => quote.extended?.price ?? quote.price

export const armedSymbols = (lines: Record<string, Drawing[]>): string[] =>
  Object.entries(lines)
    .filter(([, drawings]) => drawings.some(isArmed))
    .map(([symbol]) => symbol)

export const createAlertWatcher = (): AlertWatcher => {
  const seen = new Map<string, { price: number; day: string }>()

  const firedFor = (symbol: string, drawings: Drawing[], price: number, today: string): FiredAlert[] => {
    const previous = seen.get(symbol)
    if (previous === undefined) return []
    return drawings.filter(isArmed).flatMap((drawing) => {
      const before = alertLevel(drawing, previous.day)
      const level = alertLevel(drawing, today)
      const direction = before === null || level === null ? null : sideChange(previous.price - before, price - level)
      return level !== null && direction ? [{ symbol, drawingId: drawing.id, level, price, direction }] : []
    })
  }

  const check = (lines: Record<string, Drawing[]>, prices: Record<string, number>, today: string): FiredAlert[] => {
    const fired = Object.entries(prices).flatMap(([symbol, price]) => firedFor(symbol, lines[symbol] ?? [], price, today))
    Object.entries(prices).forEach(([symbol, price]) => seen.set(symbol, { price, day: today }))
    return fired
  }

  return { check, symbols: armedSymbols }
}
