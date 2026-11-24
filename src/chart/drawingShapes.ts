import type { Channel, Drawing, HorizontalLine, LinePoint, Rectangle, TrendLine } from '../../shared/types'
import { HANDLE_REACH, HIT_TOLERANCE, type XY, distanceToSegment, rightEnd } from './lineGeometry'

export type ShapeGeometry = {
  toPoint: (xy: XY) => LinePoint | null
  toXY: (point: LinePoint) => XY | null
  toY: (value: number) => number | null
  width: number
}

export type Segment = [XY, XY]

export type Handle = { part: string; at: XY }

export type Outline = { segments: Segment[]; fill: XY[] | null; handles: Handle[] }

type TwoPoints = { p1: LinePoint; p2: LinePoint }

const BODY = 'body'

const shifted = (xy: XY, dx: number, dy: number): XY => ({ x: xy.x + dx, y: xy.y + dy })

const middle = (a: XY, b: XY): XY => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

const raised = (point: LinePoint, by: number): LinePoint => ({ date: point.date, value: point.value + by })

const trendOutline = (line: TrendLine, geometry: ShapeGeometry): Outline | null => {
  const a = geometry.toXY(line.p1)
  const b = geometry.toXY(line.p2)
  if (!a || !b) return null
  const right = a.x <= b.x ? b : a
  const end = line.extendRight ? rightEnd(a, b, geometry.width) : right
  return {
    segments: end === right ? [[a, b]] : [[a, b], [right, end]],
    fill: null,
    handles: [
      { part: 'p1', at: a },
      { part: 'p2', at: b },
    ],
  }
}

const levelOutline = (line: HorizontalLine, geometry: ShapeGeometry): Outline | null => {
  const y = geometry.toY(line.value)
  if (y === null) return null
  return {
    segments: [[{ x: 0, y }, { x: geometry.width, y }]],
    fill: null,
    handles: [{ part: 'level', at: { x: geometry.width / 2, y } }],
  }
}

const channelOutline = (channel: Channel, geometry: ShapeGeometry): Outline | null => {
  const a = geometry.toXY(channel.p1)
  const b = geometry.toXY(channel.p2)
  const c = geometry.toXY(raised(channel.p1, channel.offset))
  const d = geometry.toXY(raised(channel.p2, channel.offset))
  if (!a || !b || !c || !d) return null
  return {
    segments: [
      [a, b],
      [c, d],
    ],
    fill: [a, b, d, c],
    handles: [
      { part: 'p1', at: a },
      { part: 'p2', at: b },
      { part: 'offset', at: middle(c, d) },
    ],
  }
}

const rectOutline = (rect: Rectangle, geometry: ShapeGeometry): Outline | null => {
  const a = geometry.toXY(rect.p1)
  const b = geometry.toXY(rect.p2)
  if (!a || !b) return null
  const q1 = { x: a.x, y: b.y }
  const q2 = { x: b.x, y: a.y }
  return {
    segments: [
      [a, q2],
      [q2, b],
      [b, q1],
      [q1, a],
    ],
    fill: [a, q2, b, q1],
    handles: [
      { part: 'p1', at: a },
      { part: 'p2', at: b },
      { part: 'q1', at: q1 },
      { part: 'q2', at: q2 },
    ],
  }
}

export const outlineOf = (drawing: Drawing, geometry: ShapeGeometry): Outline | null => {
  if (drawing.kind === 'hline') return levelOutline(drawing, geometry)
  if (drawing.kind === 'channel') return channelOutline(drawing, geometry)
  if (drawing.kind === 'rect') return rectOutline(drawing, geometry)
  return trendOutline(drawing, geometry)
}

export const hitTestOutline = (p: XY, outline: Outline): string | null => {
  const handle = outline.handles.find(({ at }) => Math.hypot(p.x - at.x, p.y - at.y) <= HANDLE_REACH)
  if (handle) return handle.part
  return outline.segments.some(([a, b]) => distanceToSegment(p, a, b) <= HIT_TOLERANCE) ? BODY : null
}

export const offsetAt = (geometry: ShapeGeometry, p1: LinePoint, p2: LinePoint, xy: XY): number | null => {
  const a = geometry.toXY(p1)
  const b = geometry.toXY(p2)
  if (!a || !b) return null
  const baseY = a.x === b.x ? a.y : a.y + ((xy.x - a.x) * (b.y - a.y)) / (b.x - a.x)
  const here = geometry.toPoint(xy)
  const onBase = geometry.toPoint({ x: xy.x, y: baseY })
  return here && onBase ? here.value - onBase.value : null
}

const movePoint = (geometry: ShapeGeometry, from: LinePoint, to: XY): LinePoint | null => {
  const moved = geometry.toPoint(to)
  const at = geometry.toXY(from)
  const rested = at ? geometry.toPoint(at) : null
  if (!moved) return null
  return rested?.date === moved.date ? { ...moved, date: from.date } : moved
}

const moveBoth = <T extends TwoPoints>(geometry: ShapeGeometry, drawing: T, start: XY, to: XY): T | null => {
  const a = geometry.toXY(drawing.p1)
  const b = geometry.toXY(drawing.p2)
  if (!a || !b) return null
  const dx = to.x - start.x
  const dy = to.y - start.y
  const p1 = movePoint(geometry, drawing.p1, shifted(a, dx, dy))
  const p2 = movePoint(geometry, drawing.p2, shifted(b, dx, dy))
  return p1 && p2 ? { ...drawing, p1, p2 } : null
}

const moveEnd = <T extends TwoPoints>(geometry: ShapeGeometry, drawing: T, part: 'p1' | 'p2', to: XY): T | null => {
  const end = movePoint(geometry, drawing[part], to)
  return end ? { ...drawing, [part]: end } : null
}

const moveLevel = (geometry: ShapeGeometry, line: HorizontalLine, start: XY, to: XY): HorizontalLine | null => {
  const y = geometry.toY(line.value)
  const moved = y === null ? null : geometry.toPoint({ x: to.x, y: y + to.y - start.y })
  return moved ? { ...line, value: moved.value } : null
}

const moveCorner = (geometry: ShapeGeometry, rect: Rectangle, part: string, to: XY): Rectangle | null => {
  const [dated, valued] = part === 'q1' ? (['p1', 'p2'] as const) : (['p2', 'p1'] as const)
  const corner = movePoint(geometry, { date: rect[dated].date, value: rect[valued].value }, to)
  if (!corner) return null
  return {
    ...rect,
    [dated]: { date: corner.date, value: rect[dated].value },
    [valued]: { date: rect[valued].date, value: corner.value },
  }
}

const moveChannel = (geometry: ShapeGeometry, channel: Channel, part: string, start: XY, to: XY): Channel | null => {
  if (part === 'p1' || part === 'p2') return moveEnd(geometry, channel, part, to)
  if (part !== 'offset') return moveBoth(geometry, channel, start, to)
  const offset = offsetAt(geometry, channel.p1, channel.p2, to)
  return offset === null ? null : { ...channel, offset }
}

export const moveDrawing = (geometry: ShapeGeometry, drawing: Drawing, part: string, start: XY, to: XY): Drawing | null => {
  if (drawing.kind === 'hline') return moveLevel(geometry, drawing, start, to)
  if (drawing.kind === 'channel') return moveChannel(geometry, drawing, part, start, to)
  if (part === 'p1' || part === 'p2') return moveEnd(geometry, drawing, part, to)
  if (drawing.kind === 'rect' && part !== BODY) return moveCorner(geometry, drawing, part, to)
  return moveBoth(geometry, drawing, start, to)
}
