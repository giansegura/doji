import type { IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive, Time } from 'lightweight-charts'
import { HANDLE_RADIUS, type XY, rightEnd } from './lineGeometry'

export type LineView = {
  a: XY
  b: XY
  color: string
  width: number
  extendRight: boolean
  selected: boolean
}

export type TrendLinesPrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

const HANDLE_BORDER = 1.5
const FULL_CIRCLE = Math.PI * 2

export const createTrendLinesPrimitive = (
  getViews: (paneWidth: number) => LineView[],
  getHandleFill: () => string,
): TrendLinesPrimitive => {
  let requestUpdate: (() => void) | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: (target) => {
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        getViews(mediaSize.width).forEach((view) => {
          const rightMost = view.a.x <= view.b.x ? view.b : view.a
          const end = view.extendRight ? rightEnd(view.a, view.b, mediaSize.width) : rightMost
          context.save()
          context.lineCap = 'round'
          context.strokeStyle = view.color
          context.lineWidth = view.width
          context.beginPath()
          context.moveTo(view.a.x, view.a.y)
          context.lineTo(view.b.x, view.b.y)
          if (end !== rightMost) {
            context.moveTo(rightMost.x, rightMost.y)
            context.lineTo(end.x, end.y)
          }
          context.stroke()
          if (view.selected) {
            ;[view.a, view.b].forEach((point) => {
              context.beginPath()
              context.arc(point.x, point.y, HANDLE_RADIUS, 0, FULL_CIRCLE)
              context.fillStyle = getHandleFill()
              context.fill()
              context.lineWidth = HANDLE_BORDER
              context.stroke()
            })
          }
          context.restore()
        })
      })
    },
  }

  const view: IPrimitivePaneView = { zOrder: () => 'top', renderer: () => renderer }

  return {
    attached: (param) => {
      requestUpdate = param.requestUpdate
    },
    detached: () => {
      requestUpdate = null
    },
    paneViews: () => [view],
    redraw: () => requestUpdate?.(),
  }
}
