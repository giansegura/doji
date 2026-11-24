import { useSyncExternalStore } from 'react'
import { Legend, type LegendProps } from './Legend'
import type { HoverStore } from './hoverStore'
import { type SeriesData, hoverAt } from './seriesData'

type LiveLegendProps = Omit<LegendProps, 'values'> & { hover: HoverStore; data: SeriesData }

export const LiveLegend = ({ hover, data, ...legend }: LiveLegendProps) => {
  const hovered = useSyncExternalStore(hover.subscribe, hover.get)
  const last = data.bars.length - 1
  const values = hoverAt(data, hovered ?? last) ?? hoverAt(data, last)

  return <Legend {...legend} values={values} />
}
