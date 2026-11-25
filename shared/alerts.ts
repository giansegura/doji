import { daysBetween, weekdaysBetween } from './dates'
import { tradesEveryDay } from './symbols'
import { canAlert, expiredAlert, isTrend } from './drawings'
import type { Drawing, Quote, TrendLine } from './types'

export type Direction = 'up' | 'down'

export type FiredAlert = { symbol: string; drawingId: string; level: number; price: number; direction: Direction }

export type AlertWatcher = {
  check: (lines: Record<string, Drawing[]>, prices: Record<string, number>, today: string) => FiredAlert[]
  symbols: (lines: Record<string, Drawing[]>) => string[]
}

const isArmed = (drawing: Drawing): boolean => drawing.pane === 'price' && canAlert(drawing) && drawing.alert === true

const isLive = (drawing: Drawing, today: string): boolean =>
  isArmed(drawing) && canAlert(drawing) && !expiredAlert(drawing, today) && !(drawing.alertRepeat && drawing.alertFiredOn === today)

const trendLevel = (line: TrendLine, today: string, everyDay: boolean): number | null => {
  const between = everyDay ? daysBetween : weekdaysBetween
  const [left, right] = line.p1.date <= line.p2.date ? [line.p1, line.p2] : [line.p2, line.p1]
  const span = between(left.date, right.date)
  if (today < left.date || (today > right.date && !line.extendRight)) return null
  if (span === 0) return right.value
  return left.value + ((right.value - left.value) * between(left.date, today)) / span
}

export const alertLevel = (drawing: Drawing, today: string, everyDay = false): number | null => {
  if (drawing.kind === 'hline') return drawing.from && today < drawing.from ? null : drawing.value
  return isTrend(drawing) ? trendLevel(drawing, today, everyDay) : null
}

export const alertLevels = (drawing: Drawing, today: string, everyDay = false): number[] => {
  if (drawing.currency) return []
  if (drawing.kind === 'position') return today >= drawing.p1.date ? [drawing.target, drawing.stop] : []
  const level = alertLevel(drawing, today, everyDay)
  return level === null ? [] : [level]
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
    return drawings.filter((drawing) => isLive(drawing, today)).flatMap((drawing) => {
      const everyDay = tradesEveryDay(symbol)
      const before = alertLevels(drawing, previous.day, everyDay)
      const hits = alertLevels(drawing, today, everyDay).flatMap((level, index) => {
        const earlier = before[index]
        const direction = earlier === undefined ? null : sideChange(previous.price - earlier, price - level)
        return direction ? [{ symbol, drawingId: drawing.id, level, price, direction }] : []
      })
      const reached = hits.sort((a, b) => Math.abs(price - a.level) - Math.abs(price - b.level))[0]
      return reached ? [reached] : []
    })
  }

  const check = (lines: Record<string, Drawing[]>, prices: Record<string, number>, today: string): FiredAlert[] => {
    const fired = Object.entries(prices).flatMap(([symbol, price]) => firedFor(symbol, lines[symbol] ?? [], price, today))
    Object.entries(prices).forEach(([symbol, price]) => seen.set(symbol, { price, day: today }))
    return fired
  }

  return { check, symbols: armedSymbols }
}
