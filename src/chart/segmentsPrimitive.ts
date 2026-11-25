import type { IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive, Time } from 'lightweight-charts'
import type { XY } from './lineGeometry'

export type PaintedSegment = { from: XY; to: XY; color: string }

export type SegmentsPrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

const WIDTH = 1.5

export const createSegmentsPrimitive = (source: { segments: () => PaintedSegment[] }): SegmentsPrimitive => {
  let requestUpdate: (() => void) | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: (target) => {
      target.useMediaCoordinateSpace(({ context }) => {
        context.save()
        context.lineWidth = WIDTH
        source.segments().forEach((segment) => {
          context.strokeStyle = segment.color
          context.beginPath()
          context.moveTo(segment.from.x, segment.from.y)
          context.lineTo(segment.to.x, segment.to.y)
          context.stroke()
        })
        context.restore()
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
