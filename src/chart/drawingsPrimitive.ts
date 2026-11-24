import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  Time,
} from 'lightweight-charts'
import type { ShapeView } from './drawingViews'
import { HANDLE_RADIUS } from './lineGeometry'

export type DrawingsPrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

const HANDLE_BORDER = 1.5
const FULL_CIRCLE = Math.PI * 2
const FILL_ALPHA = 0.12
const LABEL_TEXT = '#FFFFFF'
const ALERT_RING = 6
const ALERT_DOT = 2.5

const fillArea = (context: CanvasRenderingContext2D, view: ShapeView): void => {
  if (!view.fill) return
  const [first, ...rest] = view.fill
  context.globalAlpha = FILL_ALPHA
  context.fillStyle = view.color
  context.beginPath()
  context.moveTo(first.x, first.y)
  rest.forEach((point) => context.lineTo(point.x, point.y))
  context.closePath()
  context.fill()
  context.globalAlpha = 1
}

const strokeSegments = (context: CanvasRenderingContext2D, view: ShapeView): void => {
  context.lineCap = 'round'
  context.strokeStyle = view.color
  context.lineWidth = view.width
  context.beginPath()
  view.segments.forEach(([from, to]) => {
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
  })
  context.stroke()
}

const drawHandles = (context: CanvasRenderingContext2D, view: ShapeView, handleFill: string): void => {
  if (!view.selected) return
  view.handles.forEach(({ at }) => {
    context.beginPath()
    context.arc(at.x, at.y, HANDLE_RADIUS, 0, FULL_CIRCLE)
    context.fillStyle = handleFill
    context.fill()
    context.lineWidth = HANDLE_BORDER
    context.stroke()
  })
}

const drawAlert = (context: CanvasRenderingContext2D, view: ShapeView, handleFill: string): void => {
  if (!view.alert) return
  const { x, y } = view.alert
  context.beginPath()
  context.arc(x, y, ALERT_RING, 0, FULL_CIRCLE)
  context.fillStyle = handleFill
  context.fill()
  context.lineWidth = HANDLE_BORDER
  context.strokeStyle = view.color
  context.stroke()
  context.beginPath()
  context.arc(x, y, ALERT_DOT, 0, FULL_CIRCLE)
  context.fillStyle = view.color
  context.fill()
}

export const createDrawingsPrimitive = (getViews: () => ShapeView[], getHandleFill: () => string): DrawingsPrimitive => {
  let requestUpdate: (() => void) | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: (target) => {
      target.useMediaCoordinateSpace(({ context }) => {
        getViews().forEach((view) => {
          context.save()
          fillArea(context, view)
          strokeSegments(context, view)
          drawAlert(context, view, getHandleFill())
          drawHandles(context, view, getHandleFill())
          context.restore()
        })
      })
    },
  }

  const view: IPrimitivePaneView = { zOrder: () => 'top', renderer: () => renderer }

  const axisLabels = (): ISeriesPrimitiveAxisView[] =>
    getViews().flatMap(({ label, color }) =>
      label
        ? [{ coordinate: () => label.y, text: () => label.text, textColor: () => LABEL_TEXT, backColor: () => color }]
        : [],
    )

  return {
    attached: (param) => {
      requestUpdate = param.requestUpdate
    },
    detached: () => {
      requestUpdate = null
    },
    paneViews: () => [view],
    priceAxisViews: axisLabels,
    redraw: () => requestUpdate?.(),
  }
}
