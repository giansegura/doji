export type XY = { x: number; y: number }

export type LineHit = 'p1' | 'p2' | 'body' | null

export const HIT_TOLERANCE = 6
export const HANDLE_RADIUS = 5

const HANDLE_REACH = HANDLE_RADIUS + 3

const distance = (p: XY, q: XY): number => Math.hypot(p.x - q.x, p.y - q.y)

const rightMost = (a: XY, b: XY): XY => (a.x <= b.x ? b : a)

const leftMost = (a: XY, b: XY): XY => (a.x <= b.x ? a : b)

export const distanceToSegment = (p: XY, a: XY, b: XY): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(p, a)
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}

export const rightEnd = (a: XY, b: XY, width: number): XY => {
  const left = leftMost(a, b)
  const right = rightMost(a, b)
  if (right.x === left.x || right.x >= width) return right
  const slope = (right.y - left.y) / (right.x - left.x)
  return { x: width, y: right.y + slope * (width - right.x) }
}

export const hitTestLine = (p: XY, a: XY, b: XY, opts: { extendRight: boolean; width: number }): LineHit => {
  if (distance(p, a) <= HANDLE_REACH) return 'p1'
  if (distance(p, b) <= HANDLE_REACH) return 'p2'
  if (distanceToSegment(p, a, b) <= HIT_TOLERANCE) return 'body'
  if (opts.extendRight && distanceToSegment(p, rightMost(a, b), rightEnd(a, b, opts.width)) <= HIT_TOLERANCE) {
    return 'body'
  }
  return null
}
