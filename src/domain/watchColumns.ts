import type { SymbolMetrics } from '../../shared/symbolMetrics'
import type { Earnings, WatchColumn } from '../../shared/types'
import { formatPercent, formatPrice } from '../chart/format'

export type ColumnCell = { text: string; title?: string }

export const WATCH_COLUMN_NAMES: Record<WatchColumn, { header: string; name: string }> = {
  rsi: { header: 'RSI', name: 'RSI 14' },
  fromHigh: { header: '52W Hi', name: 'From 52-week high' },
  relVolume: { header: 'Rel Vol', name: 'Volume vs average' },
  earnings: { header: 'Earn', name: 'Next earnings' },
  level: { header: 'Level', name: 'Nearest level' },
}

const MISSING: ColumnCell = { text: '—' }

const SHORT_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const LONG_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const earningsCell = (earnings: Earnings | undefined): ColumnCell => {
  if (!earnings?.next) return MISSING
  const day = new Date(`${earnings.next}T00:00:00Z`)
  const mark = earnings.nextIsEstimate ? '~' : ''
  return { text: `${mark}${SHORT_DAY.format(day)}`, title: `Earnings ${mark}${LONG_DAY.format(day)}` }
}

export const columnCell = (
  column: WatchColumn,
  symbol: string,
  metrics: SymbolMetrics | undefined,
  earnings: Earnings | undefined,
): ColumnCell => {
  if (column === 'earnings') return earningsCell(earnings)
  if (column === 'rsi') return metrics?.rsi == null ? MISSING : { text: metrics.rsi.toFixed(1) }
  if (column === 'fromHigh') {
    if (metrics?.fromHighPercent == null) return MISSING
    const below = Math.abs(metrics.fromHighPercent).toFixed(2)
    return { text: formatPercent(metrics.fromHighPercent), title: `${below}% below the high of the last 52 weeks` }
  }
  if (column === 'relVolume') {
    if (metrics?.volumeRatio == null) return MISSING
    return { text: `${metrics.volumeRatio.toFixed(1)}×`, title: `Volume ${metrics.volumeRatio.toFixed(2)} times its 20-day average` }
  }
  const level = metrics?.level
  if (!level) return MISSING
  return { text: formatPercent(level.percent), title: `Nearest ${level.kind} at ${formatPrice(level.price, symbol)}` }
}
