import type { Channel, Drawing, HorizontalLine, LinePoint, Position, PriceZone, Rectangle, TextNote, TrendLine, VerticalLine } from '../../shared/types'
import { HANDLE_REACH, HIT_TOLERANCE, type XY, distanceToSegment, rightEnd } from './lineGeometry'

export type ShapeGeometry = {
  toPoint: (xy: XY) => LinePoint | null
  toXY: (point: LinePoint) => XY | null
  toY: (value: number) => number | null
  width: number
}

export type Segment = [XY, XY]

export type Handle = { part: string; at: XY }

export type Zone = { tone: 'profit' | 'loss'; points: XY[] }

export type Outline = { segments: Segment[]; fill: XY[] | null; handles: Handle[]; zones?: Zone[]; area?: XY[] }

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
  const start = line.from ? geometry.toXY({ date: line.from, value: line.value }) : null
  if (line.from && !start) return null
  const left = start ? start.x : 0
  return {
    segments: [[{ x: left, y }, { x: geometry.width, y }]],
    fill: null,
    handles: [{ part: 'level', at: start ? { x: left, y } : { x: geometry.width / 2, y } }],
  }
}

export const VERTICAL_REACH = 10_000

const verticalOutline = (line: VerticalLine, geometry: ShapeGeometry): Outline | null => {
  const at = geometry.toXY({ date: line.date, value: 0 })
  if (!at) return null
  return { segments: [[{ x: at.x, y: 0 }, { x: at.x, y: VERTICAL_REACH }]], fill: null, handles: [] }
}

const zoneOutline = (zone: PriceZone, geometry: ShapeGeometry): Outline | null => {
  const top = geometry.toY(zone.top)
  const bottom = geometry.toY(zone.bottom)
  if (top === null || bottom === null) return null
  const right = geometry.width
  return {
    segments: [
      [{ x: 0, y: top }, { x: right, y: top }],
      [{ x: 0, y: bottom }, { x: right, y: bottom }],
    ],
    fill: [
      { x: 0, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: 0, y: bottom },
    ],
    handles: [
      { part: 'top', at: { x: right / 2, y: top } },
      { part: 'bottom', at: { x: right / 2, y: bottom } },
    ],
  }
}

export const NOTE_CHAR_WIDTH = 7
export const NOTE_PADDING = 8
export const NOTE_HEIGHT = 18

const noteOutline = (note: TextNote, geometry: ShapeGeometry): Outline | null => {
  const at = geometry.toXY(note.p1)
  if (!at) return null
  const right = at.x + NOTE_PADDING * 2 + note.text.length * NOTE_CHAR_WIDTH
  const top = at.y - NOTE_HEIGHT
  return {
    segments: [],
    fill: null,
    handles: [],
    area: [
      { x: at.x, y: top },
      { x: right, y: top },
      { x: right, y: at.y },
      { x: at.x, y: at.y },
    ],
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

const box = (left: number, right: number, from: number, to: number): XY[] => [
  { x: left, y: from },
  { x: right, y: from },
  { x: right, y: to },
  { x: left, y: to },
]

const positionOutline = (position: Position, geometry: ShapeGeometry): Outline | null => {
  const a = geometry.toXY(position.p1)
  const b = geometry.toXY(position.p2)
  const stop = geometry.toY(position.stop)
  const target = geometry.toY(position.target)
  if (!a || !b || stop === null || target === null) return null
  const left = Math.min(a.x, b.x)
  const right = Math.max(a.x, b.x)
  const entry = a.y
  return {
    segments: [
      [{ x: left, y: entry }, { x: right, y: entry }],
      [{ x: left, y: stop }, { x: right, y: stop }],
      [{ x: left, y: target }, { x: right, y: target }],
    ],
    fill: null,
    zones: [
      { tone: 'profit', points: box(left, right, entry, target) },
      { tone: 'loss', points: box(left, right, entry, stop) },
    ],
    handles: [
      { part: 'p1', at: { x: left, y: entry } },
      { part: 'p2', at: { x: right, y: entry } },
      { part: 'stop', at: { x: left, y: stop } },
      { part: 'target', at: { x: left, y: target } },
    ],
  }
}

export const outlineOf = (drawing: Drawing, geometry: ShapeGeometry): Outline | null => {
  if (drawing.kind === 'position') return positionOutline(drawing, geometry)
  if (drawing.kind === 'hline') return levelOutline(drawing, geometry)
  if (drawing.kind === 'vline') return verticalOutline(drawing, geometry)
  if (drawing.kind === 'zone') return zoneOutline(drawing, geometry)
  if (drawing.kind === 'note') return noteOutline(drawing, geometry)
  if (drawing.kind === 'channel') return channelOutline(drawing, geometry)
  if (drawing.kind === 'rect') return rectOutline(drawing, geometry)
  return trendOutline(drawing, geometry)
}

export const hitTestOutline = (p: XY, outline: Outline): string | null => {
  const handle = outline.handles.find(({ at }) => Math.hypot(p.x - at.x, p.y - at.y) <= HANDLE_REACH)
  const inside = [...(outline.zones ?? []), ...(outline.area ? [{ points: outline.area }] : [])].some(({ points }) => {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    return p.x >= Math.min(...xs) && p.x <= Math.max(...xs) && p.y >= Math.min(...ys) && p.y <= Math.max(...ys)
  })
  if (handle) return handle.part
  return inside || outline.segments.some(([a, b]) => distanceToSegment(p, a, b) <= HIT_TOLERANCE) ? BODY : null
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
  if (line.from) {
    const anchor = geometry.toXY({ date: line.from, value: line.value })
    const moved = anchor ? movePoint(geometry, { date: line.from, value: line.value }, shifted(anchor, to.x - start.x, to.y - start.y)) : null
    return moved ? { ...line, value: moved.value, from: moved.date } : null
  }
  const y = geometry.toY(line.value)
  const moved = y === null ? null : geometry.toPoint({ x: to.x, y: y + to.y - start.y })
  return moved ? { ...line, value: moved.value } : null
}

const moveVertical = (geometry: ShapeGeometry, line: VerticalLine, to: XY): VerticalLine | null => {
  const moved = geometry.toPoint(to)
  return moved ? { ...line, date: moved.date } : null
}

const valueAt = (geometry: ShapeGeometry, value: number, dy: number): number | null => {
  const y = geometry.toY(value)
  return y === null ? null : (geometry.toPoint({ x: 0, y: y + dy })?.value ?? null)
}

const moveZone = (geometry: ShapeGeometry, zone: PriceZone, part: string, start: XY, to: XY): PriceZone | null => {
  const dy = to.y - start.y
  if (part === 'top' || part === 'bottom') {
    const moved = valueAt(geometry, zone[part], dy)
    if (moved === null) return null
    const other = part === 'top' ? zone.bottom : zone.top
    return { ...zone, top: Math.max(moved, other), bottom: Math.min(moved, other) }
  }
  const top = valueAt(geometry, zone.top, dy)
  const bottom = valueAt(geometry, zone.bottom, dy)
  return top === null || bottom === null ? null : { ...zone, top, bottom }
}

const moveNote = (geometry: ShapeGeometry, note: TextNote, start: XY, to: XY): TextNote | null => {
  const at = geometry.toXY(note.p1)
  const p1 = at ? movePoint(geometry, note.p1, shifted(at, to.x - start.x, to.y - start.y)) : null
  return p1 ? { ...note, p1 } : null
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

const onItsSide = (position: Position, level: 'stop' | 'target', price: number): boolean => {
  const above = price > position.p1.value
  const wantsAbove = (position.side === 'long') === (level === 'target')
  return price !== position.p1.value && above === wantsAbove
}

const inOrder = (geometry: ShapeGeometry, left: LinePoint, right: LinePoint): boolean => {
  const from = geometry.toXY(left)
  const to = geometry.toXY(right)
  return from !== null && to !== null && to.x > from.x
}

const movePosition = (geometry: ShapeGeometry, position: Position, part: string, start: XY, to: XY): Position | null => {
  if (part === 'stop' || part === 'target') {
    const price = geometry.toPoint(to)?.value
    if (price === undefined) return null
    return onItsSide(position, part, price) ? { ...position, [part]: price } : position
  }
  if (part === 'p2') {
    const end = movePoint(geometry, position.p2, to)
    if (!end) return null
    return inOrder(geometry, position.p1, end) ? { ...position, p2: { date: end.date, value: position.p1.value } } : position
  }
  if (part === 'p1') {
    const entry = movePoint(geometry, position.p1, to)
    if (!entry) return null
    const moved = { ...position, p1: entry }
    if (!inOrder(geometry, entry, position.p2) || !onItsSide(moved, 'stop', position.stop) || !onItsSide(moved, 'target', position.target)) return position
    return { ...moved, p2: { date: position.p2.date, value: entry.value } }
  }
  const moved = moveBoth(geometry, position, start, to)
  if (!moved) return null
  const shift = moved.p1.value - position.p1.value
  if (position.stop + shift <= 0 || position.target + shift <= 0) return position
  return { ...moved, p2: { ...moved.p2, value: moved.p1.value }, stop: position.stop + shift, target: position.target + shift }
}

export const moveDrawing = (geometry: ShapeGeometry, drawing: Drawing, part: string, start: XY, to: XY): Drawing | null => {
  if (drawing.kind === 'position') return movePosition(geometry, drawing, part, start, to)
  if (drawing.kind === 'hline') return moveLevel(geometry, drawing, start, to)
  if (drawing.kind === 'vline') return moveVertical(geometry, drawing, to)
  if (drawing.kind === 'zone') return moveZone(geometry, drawing, part, start, to)
  if (drawing.kind === 'note') return moveNote(geometry, drawing, start, to)
  if (drawing.kind === 'channel') return moveChannel(geometry, drawing, part, start, to)
  if (part === 'p1' || part === 'p2') return moveEnd(geometry, drawing, part, to)
  if (drawing.kind === 'rect' && part !== BODY) return moveCorner(geometry, drawing, part, to)
  return moveBoth(geometry, drawing, start, to)
}
