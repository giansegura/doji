import type { ChartCurrency, Drawing } from '../../shared/types'

const inCurrency = (line: Drawing, currency: ChartCurrency): boolean => (currency === 'EUR' ? line.currency === 'EUR' : !line.currency)

export const linesIn = (lines: Drawing[], currency: ChartCurrency): Drawing[] => lines.filter((line) => inCurrency(line, currency))

export const mergeLinesIn = (all: Drawing[], shown: Drawing[], currency: ChartCurrency): Drawing[] => [
  ...all.filter((line) => !inCurrency(line, currency)),
  ...(currency === 'EUR' ? shown.map((line): Drawing => ({ ...line, currency: 'EUR' })) : shown),
]
