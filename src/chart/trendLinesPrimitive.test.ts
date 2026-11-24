import type { SeriesAttachedParameter, Time } from 'lightweight-charts'
import { expect, test } from 'vitest'
import { type LineView, createTrendLinesPrimitive } from './trendLinesPrimitive'

const view = (over: Partial<LineView> = {}): LineView => ({
  a: { x: 10, y: 20 },
  b: { x: 110, y: 70 },
  color: '#2962FF',
  width: 2,
  extendRight: false,
  selected: false,
  ...over,
})

const draw = (views: LineView[], paneWidth = 400) => {
  const calls: string[] = []
  const widths: number[] = []
  const context = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    moveTo: (x: number, y: number) => calls.push(`moveTo ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo ${x},${y}`),
    arc: (x: number, y: number, radius: number) => calls.push(`arc ${x},${y} r${radius}`),
    stroke: () => calls.push(`stroke ${context.strokeStyle} ${context.lineWidth}`),
    fill: () => calls.push(`fill ${context.fillStyle}`),
  }
  const target = {
    useMediaCoordinateSpace: (callback: (scope: unknown) => void) =>
      callback({ context, mediaSize: { width: paneWidth, height: 300 } }),
  }
  const primitive = createTrendLinesPrimitive(
    (width) => {
      widths.push(width)
      return views
    },
    () => '#131722',
  )
  const paneView = primitive.paneViews?.()[0]
  paneView?.renderer()?.draw(target as never)
  return { calls, widths, zOrder: paneView?.zOrder?.() }
}

test('Should stroke each line between its two points with its own style', () => {
  const { calls } = draw([view(), view({ a: { x: 0, y: 0 }, b: { x: 5, y: 5 }, color: '#F23645', width: 4 })])
  expect(calls).toContain('moveTo 10,20')
  expect(calls).toContain('lineTo 110,70')
  expect(calls).toContain('stroke #2962FF 2')
  expect(calls).toContain('lineTo 5,5')
  expect(calls).toContain('stroke #F23645 4')
})

test('Should stop at the second point unless the line extends right', () => {
  expect(draw([view()]).calls).not.toContain('lineTo 400,215')
  expect(draw([view({ extendRight: true })]).calls).toContain('lineTo 400,215')
})

test('Should extend from the right-most point even if it was placed first', () => {
  const { calls } = draw([view({ a: { x: 110, y: 70 }, b: { x: 10, y: 20 }, extendRight: true })])
  expect(calls).toContain('lineTo 400,215')
})

test('Should draw handles only on the selected line', () => {
  expect(draw([view()]).calls.filter((call) => call.startsWith('arc'))).toEqual([])
  const selected = draw([view({ selected: true })]).calls
  expect(selected.filter((call) => call.startsWith('arc'))).toEqual(['arc 10,20 r5', 'arc 110,70 r5'])
  expect(selected).toContain('fill #131722')
})

test('Should ask for the views with the width of the pane and draw above the series', () => {
  const { widths, zOrder } = draw([view()], 640)
  expect(widths).toEqual([640])
  expect(zOrder).toBe('top')
})

test('Should request a repaint once attached and do nothing before', () => {
  let requests = 0
  const primitive = createTrendLinesPrimitive(
    () => [],
    () => '#000',
  )
  primitive.redraw()
  expect(requests).toBe(0)
  primitive.attached?.({
    requestUpdate: () => {
      requests += 1
    },
  } as unknown as SeriesAttachedParameter<Time>)
  primitive.redraw()
  expect(requests).toBe(1)
  primitive.detached?.()
  primitive.redraw()
  expect(requests).toBe(1)
})
