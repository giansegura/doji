import type { ChartCurrency, Drawing } from '../../shared/types'

const inCurrency = (line: Drawing, currency: ChartCurrency): boolean => (currency === 'EUR' ? line.currency === 'EUR' : !line.currency)

export const visibleLines = (all: Drawing[], currency: ChartCurrency, allHidden: boolean): Drawing[] =>
  allHidden ? [] : all.filter((line) => !line.hidden && inCurrency(line, currency))

export const mergeShown = (all: Drawing[], visible: Drawing[], shown: Drawing[], currency: ChartCurrency): Drawing[] => {
  const wasShown = new Set(visible.map((line) => line.id))
  const known = new Set(all.map((line) => line.id))
  const byId = new Map(shown.map((line) => [line.id, line]))
  const kept = all.flatMap((line) => {
    if (!wasShown.has(line.id)) return [line]
    const updated = byId.get(line.id)
    return updated ? [updated] : []
  })
  const added = shown.filter((line) => !known.has(line.id)).map((line): Drawing => (currency === 'EUR' ? { ...line, currency: 'EUR' } : line))
  return [...kept, ...added]
}
