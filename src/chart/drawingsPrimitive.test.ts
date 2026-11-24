import type { SeriesAttachedParameter, Time } from 'lightweight-charts'
import { expect, test } from 'vitest'
import type { ShapeView } from './drawingViews'
import { createDrawingsPrimitive } from './drawingsPrimitive'

const view = (over: Partial<ShapeView> = {}): ShapeView => ({
  segments: [[{ x: 10, y: 20 }, { x: 110, y: 70 }]],
  fill: null,
  handles: [
    { part: 'p1', at: { x: 10, y: 20 } },
    { part: 'p2', at: { x: 110, y: 70 } },
  ],
  color: '#2962FF',
  width: 2,
  selected: false,
  label: null,
  alert: null,
  ...over,
})

const draw = (views: ShapeView[]) => {
  const calls: string[] = []
  const context = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    globalAlpha: 1,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: (x: number, y: number) => calls.push(`moveTo ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo ${x},${y}`),
    arc: (x: number, y: number, radius: number) => calls.push(`arc ${x},${y} r${radius}`),
    stroke: () => calls.push(`stroke ${context.strokeStyle} ${context.lineWidth}`),
    fill: () => calls.push(`fill ${context.fillStyle} ${context.globalAlpha}`),
  }
  const target = {
    useMediaCoordinateSpace: (callback: (scope: unknown) => void) =>
      callback({ context, mediaSize: { width: 400, height: 300 } }),
  }
  const primitive = createDrawingsPrimitive(
    () => views,
    () => '#131722',
  )
  const paneView = primitive.paneViews?.()[0]
  paneView?.renderer()?.draw(target as never)
  return { calls, primitive, zOrder: paneView?.zOrder?.() }
}

test('Should stroke every segment of each drawing with its own style', () => {
  const twoLines = view({
    segments: [
      [{ x: 0, y: 0 }, { x: 5, y: 5 }],
      [{ x: 0, y: 9 }, { x: 5, y: 14 }],
    ],
    color: '#F23645',
    width: 4,
  })
  const { calls } = draw([view(), twoLines])
  expect(calls).toContain('moveTo 10,20')
  expect(calls).toContain('lineTo 110,70')
  expect(calls).toContain('stroke #2962FF 2')
  expect(calls).toContain('lineTo 5,5')
  expect(calls).toContain('lineTo 5,14')
  expect(calls).toContain('stroke #F23645 4')
})

test('Should shade the area of a drawing that has one, faintly and in its colour', () => {
  const area = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 30 }, { x: 0, y: 30 }]
  const { calls } = draw([view({ fill: area })])
  expect(calls).toContain('fill #2962FF 0.12')
  expect(calls).toContain('lineTo 50,30')
  expect(calls).toContain('closePath')
  expect(draw([view()]).calls.filter((call) => call.startsWith('fill'))).toEqual([])
})

test('Should paint the lines at full strength after shading the area', () => {
  const area = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 30 }]
  const { calls } = draw([view({ fill: area, selected: true })])
  expect(calls.filter((call) => call.startsWith('fill'))).toEqual(['fill #2962FF 0.12', 'fill #131722 1', 'fill #131722 1'])
})

test('Should draw handles only on the selected drawing', () => {
  expect(draw([view()]).calls.filter((call) => call.startsWith('arc'))).toEqual([])
  const selected = draw([view({ selected: true })]).calls
  expect(selected.filter((call) => call.startsWith('arc'))).toEqual(['arc 10,20 r5', 'arc 110,70 r5'])
  expect(selected).toContain('fill #131722 1')
})

test('Should draw above the series', () => {
  expect(draw([view()]).zOrder).toBe('top')
})

test('Should label on the price axis the drawings that carry a level', () => {
  const { primitive } = draw([view(), view({ color: '#F23645', label: { y: 120, text: '210.50' } })])
  const labels = primitive.priceAxisViews?.() ?? []
  expect(labels.map((label) => [label.coordinate(), label.text(), label.backColor(), label.textColor()])).toEqual([
    [120, '210.50', '#F23645', '#FFFFFF'],
  ])
})

test('Should request a repaint once attached and do nothing before', () => {
  let requests = 0
  const primitive = createDrawingsPrimitive(
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

test('Should ring the drawings that carry an alert with a dot inside a circle', () => {
  const { calls } = draw([view({ alert: { x: 300, y: 40 } })])
  expect(calls.filter((call) => call.startsWith('arc'))).toEqual(['arc 300,40 r6', 'arc 300,40 r2.5'])
  expect(draw([view()]).calls.filter((call) => call.startsWith('arc'))).toEqual([])
})
