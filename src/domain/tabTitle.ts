import { displaySymbol } from '../../shared/symbols'
import type { Bar, Quote } from '../../shared/types'
import { formatPercent, formatPrice } from '../chart/format'

const arrowFor = (percent: number): string => {
  const rounded = Math.round(percent * 100) / 100
  if (rounded > 0) return '▲ '
  if (rounded < 0) return '▼ '
  return ''
}

const titleOf = (symbol: string, price: number, percent: number): string =>
  `${displaySymbol(symbol)} ${formatPrice(price, symbol)} ${arrowFor(percent)}${formatPercent(percent)}`

export const tabTitle = (symbol: string, quote: Quote | null, bars: Bar[]): string => {
  const last = bars.at(-1)
  const previous = bars.at(-2)
  const shown = displaySymbol(symbol)
  if (quote) return titleOf(symbol, quote.price, quote.changePercent)
  if (!last) return shown
  if (!previous || previous.close === 0) return `${shown} ${formatPrice(last.close, symbol)}`
  return titleOf(symbol, last.close, ((last.close - previous.close) / previous.close) * 100)
}
