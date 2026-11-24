import type { Drawing, Timeframe } from '../../shared/types'
import type { Draft } from './drawingController'
import { type Outline, type ShapeGeometry, outlineOf } from './drawingShapes'
import type { XY } from './lineGeometry'
import { formatPrice } from './format'

export type AxisLabel = { y: number; text: string }

export type ShapeView = Outline & {
  color: string
  width: number
  selected: boolean
  label: AxisLabel | null
  alert: XY | null
}

type DraftStyle = { timeframe: Timeframe; color: string; width: number; pricedAt: string }

export const DRAFT_ID = 'draft'

const ALERT_MARGIN = 14

const labelOf = (drawing: Drawing, outline: Outline): AxisLabel | null =>
  drawing.kind === 'hline' ? { y: outline.segments[0][0].y, text: formatPrice(drawing.value) } : null

const alertOf = (drawing: Drawing, outline: Outline, width: number): XY | null => {
  const [[from, to]] = outline.segments
  if (drawing.kind === 'channel' || drawing.kind === 'rect' || drawing.alert !== true) return null
  if (drawing.kind === 'hline') return { x: width - ALERT_MARGIN, y: from.y }
  return from.x <= to.x ? to : from
}

export const viewOf = (drawing: Drawing, geometry: ShapeGeometry, selected: boolean): ShapeView | null => {
  const outline = outlineOf(drawing, geometry)
  if (!outline) return null
  return {
    ...outline,
    color: drawing.color,
    width: drawing.width,
    selected,
    label: labelOf(drawing, outline),
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
