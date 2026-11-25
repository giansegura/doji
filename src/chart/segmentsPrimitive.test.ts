import { expect, test } from 'vitest'
import { createSegmentsPrimitive } from './segmentsPrimitive'

test('Should draw each segment between its two points in its colour', () => {
  const calls: string[] = []
  const context = {
    strokeStyle: '',
    lineWidth: 0,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => calls.push('begin'),
    moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
    stroke: () => calls.push(`stroke ${context.strokeStyle} ${context.lineWidth}`),
  }
  const primitive = createSegmentsPrimitive({
    segments: () => [{ from: { x: 10, y: 20 }, to: { x: 60, y: 30 }, color: '#0f0' }],
  })
  primitive.paneViews?.()[0].renderer()?.draw({
    useMediaCoordinateSpace: (callback: (scope: unknown) => void) => callback({ context, mediaSize: { width: 400, height: 300 } }),
  } as never)
  expect(calls).toEqual(['begin', 'move 10,20', 'line 60,30', 'stroke #0f0 1.5'])
})
