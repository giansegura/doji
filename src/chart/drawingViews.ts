import type { Drawing, LineStyle, Timeframe } from '../../shared/types'
import type { Draft } from './drawingController'
import { type Outline, type ShapeGeometry, outlineOf } from './drawingShapes'
import type { XY } from './lineGeometry'
import { formatPrice } from './format'

export type AxisLabel = { y: number; text: string }

export type LineText = { x: number; y: number; value: string; align: 'right' | 'center' }

export type ShapeView = Outline & {
  color: string
  width: number
  lineStyle: LineStyle
  opacity: number
  text: LineText | null
  selected: boolean
  label: AxisLabel | null
  alert: XY | null
}

type DraftStyle = { timeframe: Timeframe; color: string; width: number; pricedAt: string }

export const DRAFT_ID = 'draft'

const ALERT_MARGIN = 14
const TEXT_MARGIN = 8
const TEXT_LIFT = 5
const ALERT_ROOM = 24

const labelOf = (drawing: Drawing, outline: Outline, symbol: string): AxisLabel | null =>
  drawing.kind === 'hline' && !drawing.hidePrice ? { y: outline.segments[0][0].y, text: formatPrice(drawing.value, symbol) } : null

const textOf = (drawing: Drawing, outline: Outline, width: number): LineText | null => {
  if ((drawing.kind !== undefined && drawing.kind !== 'trend' && drawing.kind !== 'hline') || !drawing.text) return null
  if (drawing.kind === 'hline') {
    const room = drawing.alert ? ALERT_ROOM : 0
    return { x: width - TEXT_MARGIN - room, y: outline.segments[0][0].y - TEXT_LIFT, value: drawing.text, align: 'right' }
  }
  const [first, second] = outline.handles.map((handle) => handle.at)
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 - TEXT_LIFT, value: drawing.text, align: 'center' }
}

const alertOf = (drawing: Drawing, outline: Outline, width: number): XY | null => {
  const [[from, to]] = outline.segments
  if (drawing.kind === 'channel' || drawing.kind === 'rect' || drawing.alert !== true) return null
  if (drawing.kind === 'hline') return { x: width - ALERT_MARGIN, y: from.y }
  return from.x <= to.x ? to : from
}

export const viewOf = (drawing: Drawing, geometry: ShapeGeometry, selected: boolean, symbol = ''): ShapeView | null => {
  const outline = outlineOf(drawing, geometry)
  if (!outline) return null
  return {
    ...outline,
    color: drawing.color,
    width: drawing.width,
    lineStyle: drawing.lineStyle ?? 'solid',
    opacity: drawing.opacity ?? 1,
    text: textOf(drawing, outline, geometry.width),
    selected,
    label: labelOf(drawing, outline, symbol),
    alert: alertOf(drawing, outline, geometry.width),
  }
}

export const draftDrawing = (draft: Draft, style: DraftStyle): Drawing => {
  const { pane, p1, p2 } = draft
  const base = { id: DRAFT_ID, pane, ...style }
  if (draft.kind === 'rect') return { ...base, kind: 'rect', p1, p2 }
  if (draft.kind === 'channel') return { ...base, kind: 'channel', p1, p2, offset: draft.offset ?? 0 }
  return { ...base, p1, p2, extendRight: false }
}
