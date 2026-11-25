import { useSyncExternalStore } from 'react'
import type { Dividend } from '../../shared/types'
import { dividendLabel, dividendOfBar } from '../domain/dividends'
import { Legend, type LegendProps } from './Legend'
import type { HoverStore } from './hoverStore'
import { type SeriesData, hoverAt } from './seriesData'

type LiveLegendProps = Omit<LegendProps, 'values' | 'dividend'> & { hover: HoverStore; data: SeriesData; dividends?: Dividend[] }

const NO_DIVIDENDS: Dividend[] = []

export const LiveLegend = ({ hover, data, dividends = NO_DIVIDENDS, ...legend }: LiveLegendProps) => {
  const hovered = useSyncExternalStore(hover.subscribe, hover.get)
  const last = data.bars.length - 1
  const shown = hovered !== null && hovered >= 0 && hovered <= last ? hovered : last
  const values = hoverAt(data, shown) ?? hoverAt(data, last)
  const paid = dividendOfBar(dividends, data.bars, shown, legend.timeframe)

  return <Legend {...legend} values={values} dividend={paid ? dividendLabel(paid) : null} />
}
