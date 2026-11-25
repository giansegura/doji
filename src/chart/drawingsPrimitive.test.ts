import type { SeriesAttachedParameter, Time } from 'lightweight-charts'
import { expect, test } from 'vitest'
import type { ShapeView } from './drawingViews'
import { type MeasureView, createDrawingsPrimitive } from './drawingsPrimitive'

const view = (over: Partial<ShapeView> = {}): ShapeView => ({
  segments: [[{ x: 10, y: 20 }, { x: 110, y: 70 }]],
  fill: null,
  handles: [
    { part: 'p1', at: { x: 10, y: 20 } },
    { part: 'p2', at: { x: 110, y: 70 } },
  ],
  color: '#2962FF',
  width: 2,
  lineStyle: 'solid',
  opacity: 1,
  text: null,
  zones: [],
  badges: [],
  selected: false,
  label: null,
  alert: null,
  ...over,
})

const draw = (views: ShapeView[], measure: MeasureView | null = null) => {
  const calls: string[] = []
  const strokes: string[] = []
  const context = {
    lineDash: [] as number[],
    setLineDash: (pattern: number[]) => {
      context.lineDash = pattern
    },
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
    stroke: () => {
      calls.push(`stroke ${context.strokeStyle} ${context.lineWidth}`)
      strokes.push(`${context.strokeStyle} alpha ${context.globalAlpha} dash ${context.lineDash.join(',') || 'none'}`)
    },
    fill: () => calls.push(`fill ${context.fillStyle} ${context.globalAlpha}`),
    font: '',
    textAlign: '',
    textBaseline: '',
    measureText: (value: string) => ({ width: value.length * 6 }),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect ${x},${y} ${width}x${height} ${context.fillStyle} ${context.globalAlpha}`),
    fillText: (value: string, x: number, y: number) =>
      calls.push(`text ${value} ${x},${y} ${context.textAlign} ${context.fillStyle} ${context.globalAlpha}`),
  }
  const target = {
    useMediaCoordinateSpace: (callback: (scope: unknown) => void) =>
      callback({ context, mediaSize: { width: 400, height: 300 } }),
  }
  const primitive = createDrawingsPrimitive(
    () => views,
    () => '#131722',
    () => measure,
  )
  const paneView = primitive.paneViews?.()[0]
  paneView?.renderer()?.draw(target as never)
  return { calls, strokes, primitive, zOrder: paneView?.zOrder?.() }
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

test('Should dash or dot a line in step with its width and keep the others solid', () => {
  const { strokes } = draw([
    view({ color: '#A', width: 1, lineStyle: 'dashed' }),
    view({ color: '#B', width: 2, lineStyle: 'dotted' }),
    view({ color: '#C', width: 2 }),
  ])
  expect(strokes).toEqual(['#A alpha 1 dash 5,4', '#B alpha 1 dash 2,4', '#C alpha 1 dash none'])
})

test('Should paint a translucent line and its fill with its opacity and keep the handles opaque', () => {
  const { calls, strokes } = draw([
    view({
      color: '#FFFFFF',
      opacity: 0.5,
      selected: true,
      fill: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    }),
  ])
  expect(calls).toContain('fill #FFFFFF 0.06')
  expect(strokes[0]).toBe('#FFFFFF alpha 0.5 dash none')
  expect(strokes.slice(1).every((stroke) => stroke.includes('alpha 1 dash none'))).toBe(true)
})

test('Should write the text of a line in its colour even when the line is faint', () => {
  const { calls } = draw([
    view({ color: '#FFFFFF', opacity: 0.5, text: { x: 380, y: 40, value: 'Soporte', align: 'right' } }),
  ])
  expect(calls).toContain('text Soporte 380,40 right #FFFFFF 1')
})

test('Should paint the box of a text note faintly behind its text', () => {
  const { calls } = draw([
    view({ color: '#FF9800', segments: [], text: { x: 108, y: 57, value: 'Earnings', align: 'left', box: { x: 100, y: 42, width: 72, height: 18 } } }),
  ])
  const box = calls.indexOf('fillRect 100,42 72x18 #FF9800 0.18')
  expect(box).toBeGreaterThan(-1)
  expect(calls.indexOf('text Earnings 108,57 left #FF9800 1')).toBeGreaterThan(box)
})

test('Should shade a measure, point its arrows to where it ends and write its reading below it', () => {
  const { calls } = draw([], {
    from: { x: 100, y: 200 },
    to: { x: 200, y: 120 },
    color: '#3CC68A',
    lines: ['+30.00 (+15.00%)', '22 bars, 32d'],
  })
  expect(calls).toContain('fillRect 100,120 100x80 #3CC68A 0.15')
  expect(calls).toContain('moveTo 150,200')
  expect(calls).toContain('lineTo 150,120')
  expect(calls).toContain('moveTo 100,160')
  expect(calls).toContain('lineTo 200,160')
  expect(calls.filter((call) => call.startsWith('text +30.00 (+15.00%) 150,') || call.startsWith('text 22 bars, 32d 150,'))).toHaveLength(2)
  expect(calls.find((call) => call.startsWith('fillRect') && call.includes('#3CC68A 1'))).toMatch(/fillRect 94,208 112x40 /)
})

test('Should write the reading of a measure above it when there is no room below', () => {
  const { calls } = draw([], { from: { x: 100, y: 200 }, to: { x: 200, y: 290 }, color: '#F25C69', lines: ['−9.00 (−4.50%)', '3 bars, 3d'] })
  expect(calls.find((call) => call.startsWith('fillRect') && call.includes('#F25C69 1'))).toMatch(/fillRect \d+,152 /)
})

test('Should keep the reading of a measure inside the pane when it fits neither below nor above', () => {
  const { calls } = draw([], { from: { x: 100, y: 10 }, to: { x: 200, y: 290 }, color: '#3CC68A', lines: ['+50.00 (+20.00%)', '30 bars, 42d'] })
  expect(calls.find((call) => call.startsWith('fillRect') && call.includes('#3CC68A 1'))).toMatch(/fillRect \d+,242 /)
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

test('Should write the axis label in a dark colour on light lines so it can be read', () => {
  const { primitive } = draw([
    view({ color: '#FFFFFF', label: { y: 80, text: '197.63' } }),
    view({ color: '#FDD835', label: { y: 90, text: '180.00' } }),
    view({ color: '#2962FF', label: { y: 100, text: '150.00' } }),
  ])
  expect((primitive.priceAxisViews?.() ?? []).map((label) => [label.backColor(), label.textColor()])).toEqual([
    ['#FFFFFF', '#0E0D0C'],
    ['#FDD835', '#0E0D0C'],
    ['#2962FF', '#FFFFFF'],
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

test('Should shade the zones of a position faintly and write its labels on solid boxes', () => {
  const { calls } = draw([
    view({
      zones: [{ color: '#3CC68A', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }],
      badges: [{ x: 100, y: 50, color: '#3CC68A', lines: ['Target 115.00 (+15.00%)', 'R:R 3.00'] }],
    }),
  ])
  expect(calls).toContain('fill #3CC68A 0.18')
  expect(calls.some((call) => call.startsWith('fillRect') && call.includes('#3CC68A 1'))).toBe(true)
  expect(calls.filter((call) => call.startsWith('text Target 115.00 (+15.00%)') || call.startsWith('text R:R 3.00'))).toHaveLength(2)
})

test('Should shade the zones of a position with the opacity of the drawing', () => {
  const zones = [{ color: '#3CC68A', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }]
  expect(draw([view({ zones, opacity: 0.5 })]).calls).toContain('fill #3CC68A 0.09')
  expect(draw([view({ zones, opacity: 0 })]).calls).toContain('fill #3CC68A 0')
})
