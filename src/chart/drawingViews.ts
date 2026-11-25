import type { Drawing, LineStyle, Position, Timeframe } from '../../shared/types'
import { canAlert, isTrend } from '../../shared/drawings'
import { positionReading } from '../domain/position'
import type { Draft } from './drawingController'
import { NOTE_PADDING, type Outline, type ShapeGeometry, type Segment, outlineOf } from './drawingShapes'
import type { XY } from './lineGeometry'
import { formatPercent, formatPrice } from './format'

export type AxisLabel = { y: number; text: string }

export type TextBox = { x: number; y: number; width: number; height: number }

export type LineText = { x: number; y: number; value: string; align: 'right' | 'center' | 'left'; box?: TextBox }

export type PaintedZone = { points: XY[]; color: string }

export type Badge = { x: number; y: number; color: string; lines: string[] }

export type Tones = { profit: string; loss: string }

const DEFAULT_TONES: Tones = { profit: '#089981', loss: '#F23645' }

export type ShapeView = Omit<Outline, 'zones'> & {
  color: string
  width: number
  lineStyle: LineStyle
  opacity: number
  text: LineText | null
  zones: PaintedZone[]
  badges: Badge[]
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
const NOTE_BASELINE = 3
const ZONE_TEXT_DROP = 14
const ARROW_HEAD = 12
const ARROW_ANGLE = Math.PI / 6

const labelOf = (drawing: Drawing, outline: Outline, symbol: string): AxisLabel | null =>
  drawing.kind === 'hline' && !drawing.hidePrice ? { y: outline.segments[0][0].y, text: formatPrice(drawing.value, symbol) } : null

const textOf = (drawing: Drawing, outline: Outline, width: number): LineText | null => {
  if (drawing.kind === 'note') {
    const [corner, , far] = outline.area ?? []
    if (!corner || !far) return null
    const box = { x: corner.x, y: corner.y, width: far.x - corner.x, height: far.y - corner.y }
    return { x: box.x + NOTE_PADDING, y: far.y - NOTE_BASELINE, value: drawing.text, align: 'left', box }
  }
  if (drawing.kind === 'zone') {
    const top = Math.min(outline.segments[0][0].y, outline.segments[1][0].y)
    return drawing.text ? { x: TEXT_MARGIN, y: top + ZONE_TEXT_DROP, value: drawing.text, align: 'left' } : null
  }
  if ((drawing.kind !== undefined && drawing.kind !== 'trend' && drawing.kind !== 'hline') || !drawing.text) return null
  if (drawing.kind === 'hline') {
    const room = drawing.alert ? ALERT_ROOM : 0
    return { x: width - TEXT_MARGIN - room, y: outline.segments[0][0].y - TEXT_LIFT, value: drawing.text, align: 'right' }
  }
  const [first, second] = outline.handles.map((handle) => handle.at)
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 - TEXT_LIFT, value: drawing.text, align: 'center' }
}

const alertOf = (drawing: Drawing, outline: Outline, width: number): XY | null => {
  if (!canAlert(drawing) || drawing.alert !== true) return null
  const [[from, to]] = outline.segments
  if (drawing.kind === 'hline') return { x: width - ALERT_MARGIN, y: from.y }
  return from.x <= to.x ? to : from
}

const arrowHead = (from: XY, to: XY): Segment[] => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  return [1, -1].map((side): Segment => [
    to,
    { x: to.x - ARROW_HEAD * Math.cos(angle + side * ARROW_ANGLE), y: to.y - ARROW_HEAD * Math.sin(angle + side * ARROW_ANGLE) },
  ])
}

const withArrow = (drawing: Drawing, outline: Outline): Segment[] => {
  if (!isTrend(drawing) || !drawing.arrow) return outline.segments
  const [from, to] = outline.handles.map((handle) => handle.at)
  return from && to ? [...outline.segments, ...arrowHead(from, to)] : outline.segments
}

const centreOf = (points: XY[]): XY => {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

const positionBadges = (position: Position, outline: Outline, symbol: string, tones: Tones): Badge[] => {
  const [profit, loss] = outline.zones ?? []
  if (!profit || !loss) return []
  const reading = positionReading(position)
  const sizing = reading.shares !== null && reading.risk !== null ? [`${reading.shares} shares · risk ${formatPrice(reading.risk, symbol)}`] : []
  return [
    {
      ...centreOf(profit.points),
      color: tones.profit,
      lines: [`Target ${formatPrice(position.target, symbol)} (${formatPercent(reading.targetPercent)})`, `R:R ${reading.rewardToRisk.toFixed(2)}`],
    },
    {
      ...centreOf(loss.points),
      color: tones.loss,
      lines: [`Stop ${formatPrice(position.stop, symbol)} (${formatPercent(reading.stopPercent)})`, ...sizing],
    },
  ]
}

export const viewOf = (
  drawing: Drawing,
  geometry: ShapeGeometry,
  selected: boolean,
  symbol = '',
  tones: Tones = DEFAULT_TONES,
): ShapeView | null => {
  const outline = outlineOf(drawing, geometry)
  if (!outline) return null
  const { zones, ...shape } = outline
  return {
    ...shape,
    segments: withArrow(drawing, outline),
    color: drawing.color,
    width: drawing.width,
    lineStyle: drawing.lineStyle ?? 'solid',
    opacity: drawing.opacity ?? 1,
    text: textOf(drawing, outline, geometry.width),
    zones: (zones ?? []).map((zone) => ({ points: zone.points, color: tones[zone.tone] })),
    badges: drawing.kind === 'position' ? positionBadges(drawing, outline, symbol, tones) : [],
    selected,
    label: labelOf(drawing, outline, symbol),
    alert: alertOf(drawing, outline, geometry.width),
  }
}

export const draftDrawing = (draft: Draft, style: DraftStyle): Drawing => {
  const { pane, p1, p2 } = draft
  const base = { id: DRAFT_ID, pane, ...style }
  if (draft.kind === 'rect') return { ...base, kind: 'rect', p1, p2 }
  if (draft.kind === 'zone') return { ...base, kind: 'zone', top: Math.max(p1.value, p2.value), bottom: Math.min(p1.value, p2.value) }
  if (draft.kind === 'channel') return { ...base, kind: 'channel', p1, p2, offset: draft.offset ?? 0 }
  return { ...base, p1, p2, extendRight: false }
}
