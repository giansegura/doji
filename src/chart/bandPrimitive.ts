import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesType,
  Time,
} from 'lightweight-charts'

export const createBandPrimitive = (top: number, bottom: number, color: string): ISeriesPrimitive<Time> => {
  let series: ISeriesApi<SeriesType, Time> | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: () => undefined,
    drawBackground: (target) => {
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const yTop = series?.priceToCoordinate(top) ?? null
        const yBottom = series?.priceToCoordinate(bottom) ?? null
        if (yTop === null || yBottom === null) return
        context.fillStyle = color
        context.fillRect(0, yTop, mediaSize.width, yBottom - yTop)
      })
    },
  }

  const view: IPrimitivePaneView = { zOrder: () => 'bottom', renderer: () => renderer }

  return {
    attached: (param) => {
      series = param.series
    },
    detached: () => {
      series = null
    },
    paneViews: () => [view],
  }
}
