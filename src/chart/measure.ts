import type { LinePoint, PaneId } from '../../shared/types'
import { priceDigits } from '../../shared/symbols'
import { formatPercent, formatSigned } from './format'

export type Measure = { pane: PaneId; p1: LinePoint; p2: LinePoint }

export type MeasureReading = { change: number; percent: number; bars: number; days: number }

const DAY_MS = 86_400_000

export const readMeasure = (p1: LinePoint, p2: LinePoint, bars: number): MeasureReading => {
  const change = p2.value - p1.value
  return {
    change,
    percent: p1.value !== 0 ? (change / p1.value) * 100 : 0,
    bars: Math.abs(bars),
    days: Math.round(Math.abs(Date.parse(p2.date) - Date.parse(p1.date)) / DAY_MS),
  }
}

export const measureLines = (reading: MeasureReading, symbol: string): [string, string] => [
  `${formatSigned(reading.change, priceDigits(symbol, Math.abs(reading.change)))} (${formatPercent(reading.percent)})`,
  `${reading.bars} ${reading.bars === 1 ? 'bar' : 'bars'}, ${reading.days}d`,
]
