import type { IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, SeriesType, Time } from 'lightweight-charts'
import type { Drawing } from '../../shared/types'

type LevelsSource = { prices: () => number[]; color: () => string }

export type LevelsPrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

export const LEVEL_LOOK = { width: 1, lineStyle: 'dashed' as const, opacity: 0.5, hidePrice: true as const }

const DASH = [5, 4]

export const levelsToShow = (prices: number[], drawings: Drawing[], tolerance: number): number[] => {
  const taken = drawings.flatMap((drawing) => (drawing.kind === 'hline' && drawing.pane === 'price' ? [drawing.value] : []))
  return prices.filter((price) => taken.every((value) => Math.abs(value - price) > price * tolerance))
}

export const createLevelsPrimitive = (source: LevelsSource): LevelsPrimitive => {
  let series: Pick<ISeriesApi<SeriesType>, 'priceToCoordinate'> | null = null
  let requestUpdate: (() => void) | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: (target) => {
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const current = series
        if (!current) return
        const ys = source.prices().flatMap((price) => {
          const y = current.priceToCoordinate(price)
          return y === null ? [] : [y]
        })
        if (ys.length === 0) return
        context.save()
        context.strokeStyle = source.color()
        context.lineWidth = LEVEL_LOOK.width
        context.globalAlpha = LEVEL_LOOK.opacity
        context.setLineDash(DASH)
        context.beginPath()
        ys.forEach((y) => {
          context.moveTo(0, y)
          context.lineTo(mediaSize.width, y)
        })
        context.stroke()
        context.restore()
      })
    },
  }

  const view: IPrimitivePaneView = { zOrder: () => 'top', renderer: () => renderer }

  return {
    attached: (param) => {
      series = param.series
      requestUpdate = param.requestUpdate
    },
    detached: () => {
      series = null
      requestUpdate = null
    },
    paneViews: () => [view],
    redraw: () => requestUpdate?.(),
  }
}
