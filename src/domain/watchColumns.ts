import type { SymbolMetrics } from '../../shared/symbolMetrics'
import type { Earnings, Holding, Quote, WatchColumn } from '../../shared/types'
import { formatPercent, formatPrice } from '../chart/format'
import { formatMoney, holdingGain } from './holdings'

export type ColumnCell = { text: string; title?: string }

export type CellSource = { symbol: string; metrics?: SymbolMetrics; earnings?: Earnings; holding?: Holding; quote?: Quote }

export const WATCH_COLUMN_NAMES: Record<WatchColumn, { header: string; name: string }> = {
  rsi: { header: 'RSI', name: 'RSI 14' },
  fromHigh: { header: '52W Hi', name: 'From 52-week high' },
  relVolume: { header: 'Rel Vol', name: 'Volume vs average' },
  earnings: { header: 'Earn', name: 'Next earnings' },
  level: { header: 'Level', name: 'Nearest level' },
  gain: { header: 'P/L %', name: 'Position gain %' },
  gainValue: { header: 'P/L', name: 'Position gain' },
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

const gainCell = (column: 'gain' | 'gainValue', source: CellSource): ColumnCell => {
  const { holding, quote, symbol } = source
  if (!holding || !quote) return MISSING
  const gain = holdingGain(holding, quote.price)
  const title = `${holding.quantity} shares at ${formatPrice(holding.price, symbol)}`
  return { text: column === 'gain' ? formatPercent(gain.percent) : formatMoney(gain.value, quote.currency), title }
}

export const columnCell = (column: WatchColumn, source: CellSource): ColumnCell => {
  const { symbol, metrics, earnings } = source
  if (column === 'gain' || column === 'gainValue') return gainCell(column, source)
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
