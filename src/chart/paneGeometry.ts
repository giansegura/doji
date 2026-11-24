import type { PaneGeometry } from './drawingController'
import type { TimeIndex } from './timeIndex'

export type PaneSource = {
  logicalToCoordinate: (index: number) => number | null
  valueToCoordinate: (value: number) => number | null
  coordinateToValue: (y: number) => number | null
  width: number
  timeIndex: TimeIndex
}

export const createPaneGeometry = (source: PaneSource): PaneGeometry | null => {
  const origin = source.logicalToCoordinate(0)
  const next = source.logicalToCoordinate(1)
  if (origin === null || next === null || next === origin) return null
  const spacing = next - origin

  return {
    width: source.width,
    toXY: (point) => {
      const x = source.logicalToCoordinate(source.timeIndex.dateToIndex(point.date))
      const y = source.valueToCoordinate(point.value)
      return x === null || y === null ? null : { x, y }
    },
    toPoint: ({ x, y }) => {
      const value = source.coordinateToValue(y)
      if (value === null) return null
      return { date: source.timeIndex.indexToDate(Math.round((x - origin) / spacing)), value }
    },
  }
}
