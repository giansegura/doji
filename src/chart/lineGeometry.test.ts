import { expect, test } from 'vitest'
import { distanceToSegment, hitTestLine, rightEnd } from './lineGeometry'

const a = { x: 0, y: 0 }
const b = { x: 10, y: 0 }
const far = { x: 100, y: 0 }

test('Should measure distance to a segment, including past its ends', () => {
  expect(distanceToSegment({ x: 5, y: 5 }, a, b)).toBe(5)
  expect(distanceToSegment({ x: 13, y: 4 }, a, b)).toBe(5)
  expect(distanceToSegment({ x: 3, y: 0 }, a, a)).toBe(3)
})

test('Should extend from the right-most end regardless of point order', () => {
  expect(rightEnd(a, { x: 10, y: 5 }, 100)).toEqual({ x: 100, y: 50 })
  expect(rightEnd({ x: 10, y: 5 }, a, 100)).toEqual({ x: 100, y: 50 })
})

test('Should not extend a vertical line', () => {
  expect(rightEnd({ x: 10, y: 0 }, { x: 10, y: 20 }, 100)).toEqual({ x: 10, y: 20 })
})

test('Should not extend a line that already reaches the right edge', () => {
  expect(rightEnd(a, { x: 120, y: 60 }, 100)).toEqual({ x: 120, y: 60 })
})

test('Should prefer handles over the body', () => {
  const opts = { extendRight: false, width: 200 }
  expect(hitTestLine({ x: 2, y: 2 }, a, far, opts)).toBe('p1')
  expect(hitTestLine({ x: 99, y: 1 }, a, far, opts)).toBe('p2')
  expect(hitTestLine({ x: 50, y: 4 }, a, far, opts)).toBe('body')
  expect(hitTestLine({ x: 50, y: 12 }, a, far, opts)).toBe(null)
})

test('Should hit the extension only when the line extends right', () => {
  const p = { x: 150, y: 0 }
  expect(hitTestLine(p, a, far, { extendRight: true, width: 200 })).toBe('body')
  expect(hitTestLine(p, a, far, { extendRight: false, width: 200 })).toBe(null)
})
