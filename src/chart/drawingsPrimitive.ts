import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  Time,
} from 'lightweight-charts'
import { textOn } from '../theme/alpha'
import type { LineStyle } from '../../shared/types'
import type { ShapeView } from './drawingViews'
import { HANDLE_RADIUS, type XY } from './lineGeometry'

export type DrawingsPrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

export type MeasureView = { from: XY; to: XY; color: string; lines: [string, string] }

type Size = { width: number; height: number }

const HANDLE_BORDER = 1.5
const FULL_CIRCLE = Math.PI * 2
const FILL_ALPHA = 0.12
const ALERT_RING = 6
const ALERT_DOT = 2.5
const ZONE_FILL = 0.18
const BADGE_PADDING = 6
const BADGE_LINE = 15
const MEASURE_FILL = 0.15
const ARROW_HEAD = 6
const LABEL_GAP = 8
const LABEL_PADDING = 8
const LABEL_LINE = 16
const LABEL_HEIGHT = LABEL_LINE * 2 + LABEL_GAP
const TEXT_FONT = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const DASHES: Record<LineStyle, (width: number) => number[]> = {
  solid: () => [],
  dashed: (width) => [width * 5, width * 4],
  dotted: (width) => [width, width * 2],
}

const fillArea = (context: CanvasRenderingContext2D, view: ShapeView): void => {
  if (!view.fill) return
  const [first, ...rest] = view.fill
  context.globalAlpha = FILL_ALPHA * view.opacity
  context.fillStyle = view.color
  context.beginPath()
  context.moveTo(first.x, first.y)
  rest.forEach((point) => context.lineTo(point.x, point.y))
  context.closePath()
  context.fill()
  context.globalAlpha = 1
}

const strokeSegments = (context: CanvasRenderingContext2D, view: ShapeView): void => {
  context.lineCap = view.lineStyle === 'solid' ? 'round' : 'butt'
  context.strokeStyle = view.color
  context.lineWidth = view.width
  context.globalAlpha = view.opacity
  context.setLineDash(DASHES[view.lineStyle](view.width))
  context.beginPath()
  view.segments.forEach(([from, to]) => {
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
  })
  context.stroke()
  context.globalAlpha = 1
  context.setLineDash([])
}

const shadeZones = (context: CanvasRenderingContext2D, view: ShapeView): void => {
  view.zones.forEach((zone) => {
    const [first, ...rest] = zone.points
    if (!first) return
    context.globalAlpha = ZONE_FILL
    context.fillStyle = zone.color
    context.beginPath()
    context.moveTo(first.x, first.y)
    rest.forEach((point) => context.lineTo(point.x, point.y))
    context.closePath()
    context.fill()
  })
  context.globalAlpha = 1
}

const drawBadges = (context: CanvasRenderingContext2D, view: ShapeView): void => {
  context.font = TEXT_FONT
  view.badges.forEach((badge) => {
    const width = Math.max(...badge.lines.map((line) => context.measureText(line).width)) + BADGE_PADDING * 2
    const height = badge.lines.length * BADGE_LINE + BADGE_PADDING
    const top = badge.y - height / 2
    context.globalAlpha = 1
    context.fillStyle = badge.color
    context.fillRect(badge.x - width / 2, top, width, height)
    context.fillStyle = textOn(badge.color)
    context.textAlign = 'center'
    context.textBaseline = 'top'
    badge.lines.forEach((line, index) => context.fillText(line, badge.x, top + BADGE_PADDING / 2 + index * BADGE_LINE))
  })
}

const writeText = (context: CanvasRenderingContext2D, view: ShapeView): void => {
  if (!view.text) return
  context.font = TEXT_FONT
  context.textAlign = view.text.align
  context.textBaseline = 'bottom'
  context.fillStyle = view.color
  context.fillText(view.text.value, view.text.x, view.text.y)
}

const arrow = (context: CanvasRenderingContext2D, from: XY, to: XY): void => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  ;[-1, 1].forEach((side) => {
    context.moveTo(to.x, to.y)
    context.lineTo(to.x - ARROW_HEAD * Math.cos(angle + (side * Math.PI) / 6), to.y - ARROW_HEAD * Math.sin(angle + (side * Math.PI) / 6))
  })
}

const labelTop = (top: number, bottom: number, height: number): number => {
  const below = bottom + LABEL_GAP
  const above = top - LABEL_GAP - LABEL_HEIGHT
  if (below + LABEL_HEIGHT <= height) return below
  if (above >= 0) return above
  return Math.min(Math.max(bottom - LABEL_GAP - LABEL_HEIGHT, 0), Math.max(height - LABEL_HEIGHT, 0))
}

const drawMeasure = (context: CanvasRenderingContext2D, measure: MeasureView, size: Size): void => {
  const { from, to, color, lines } = measure
  const left = Math.min(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  context.globalAlpha = MEASURE_FILL
  context.fillStyle = color
  context.fillRect(left, top, Math.abs(to.x - from.x), bottom - top)
  context.globalAlpha = 1
  context.strokeStyle = color
  context.lineWidth = 1
  context.beginPath()
  arrow(context, { x: middle.x, y: from.y }, { x: middle.x, y: to.y })
  arrow(context, { x: from.x, y: middle.y }, { x: to.x, y: middle.y })
  context.stroke()
  context.font = TEXT_FONT
  const width = Math.max(...lines.map((line) => context.measureText(line).width)) + LABEL_PADDING * 2
  const y = labelTop(top, bottom, size.height)
  context.fillStyle = color
  context.fillRect(middle.x - width / 2, y, width, LABEL_HEIGHT)
  context.fillStyle = textOn(color)
  context.textAlign = 'center'
  context.textBaseline = 'top'
  lines.forEach((line, index) => context.fillText(line, middle.x, y + LABEL_GAP / 2 + index * LABEL_LINE))
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

export const createDrawingsPrimitive = (
  getViews: () => ShapeView[],
  getHandleFill: () => string,
  getMeasure: () => MeasureView | null = () => null,
): DrawingsPrimitive => {
  let requestUpdate: (() => void) | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: (target) => {
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        getViews().forEach((view) => {
          context.save()
          shadeZones(context, view)
          fillArea(context, view)
          strokeSegments(context, view)
          writeText(context, view)
          drawBadges(context, view)
          drawAlert(context, view, getHandleFill())
          drawHandles(context, view, getHandleFill())
          context.restore()
        })
        const measure = getMeasure()
        if (!measure) return
        context.save()
        drawMeasure(context, measure, mediaSize)
        context.restore()
      })
    },
  }

  const view: IPrimitivePaneView = { zOrder: () => 'top', renderer: () => renderer }

  const axisLabels = (): ISeriesPrimitiveAxisView[] =>
    getViews().flatMap(({ label, color }) =>
      label
        ? [{ coordinate: () => label.y, text: () => label.text, textColor: () => textOn(color), backColor: () => color }]
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
