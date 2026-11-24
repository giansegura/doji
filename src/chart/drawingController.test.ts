import { expect, test } from 'vitest'
import type { Channel, Drawing, DrawingKind, HorizontalLine, LineLook, Rectangle, Timeframe, TrendLine } from '../../shared/types'
import { type Draft, type PaneGeometry, createDrawingController, isLineVisible } from './drawingController'
import type { Measure } from './measure'

const geometry: PaneGeometry = {
  toPoint: ({ x, y }) => ({ date: `d${Math.round(x)}`, value: y }),
  toXY: (point) => ({ x: Number(point.date.slice(1)), y: point.value }),
  toY: (value) => value,
  width: 500,
}

const weekStart = (day: number): number => Math.floor(day / 7) * 7

const weekly: PaneGeometry = {
  toPoint: ({ x, y }) => ({ date: `d${weekStart(x)}`, value: y }),
  toXY: (point) => ({ x: weekStart(Number(point.date.slice(1))), y: point.value }),
  toY: (value) => value,
  width: 500,
}

const valueless: PaneGeometry = { ...geometry, toPoint: () => null }

const line = (over: Partial<TrendLine> = {}): TrendLine => ({
  id: 'a',
  pane: 'price',
  timeframe: 'D',
  p1: { date: 'd0', value: 0 },
  p2: { date: 'd100', value: 0 },
  color: '#2962FF',
  width: 2,
  extendRight: false,
  pricedAt: '2020-01-01',
  ...over,
})

type Options = {
  lines?: Drawing[]
  timeframe?: Timeframe
  rsiVisible?: boolean
  missingPane?: boolean
  weekly?: boolean
  noValues?: boolean
  looks?: Partial<Record<DrawingKind, LineLook>>
}

const geometryFor = (options: Options): PaneGeometry | null => {
  if (options.missingPane) return null
  if (options.noValues) return valueless
  return options.weekly ? weekly : geometry
}

const harness = (options: Options = {}) => {
  const record = {
    lines: (options.lines ?? []) as TrendLine[],
    draft: null as Draft | null,
    measure: null as Measure | null,
    selected: null as string | null,
    toolDone: 0,
    emitted: 0,
  }
  let counter = 0
  const controller = createDrawingController({
    getLines: () => record.lines,
    getTimeframe: () => options.timeframe ?? 'D',
    isRsiVisible: () => options.rsiVisible ?? true,
    geometry: () => geometryFor(options),
    onLinesChange: (lines) => {
      record.lines = lines as TrendLine[]
      record.emitted += 1
    },
    onSelect: (id) => {
      record.selected = id
    },
    onDraft: (draft) => {
      record.draft = draft
    },
    onMeasure: (measure) => {
      record.measure = measure
    },
    onToolDone: () => {
      record.toolDone += 1
    },
    newId: () => {
      counter += 1
      return `id${counter}`
    },
    priceBasis: () => '2020-08-31',
    lookFor: (kind) => options.looks?.[kind] ?? { color: '#2962FF', width: 2 },
  })
  return { record, controller, options }
}

test('Should create a line with two clicks and return to the cursor', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  expect(controller.pointerDown('price', { x: 10, y: 10 })).toBe(true)
  controller.pointerUp('price', { x: 10, y: 10 })
  controller.pointerMove('price', { x: 30, y: 20 })
  expect(record.draft).toEqual({ pane: 'price', p1: { date: 'd10', value: 10 }, p2: { date: 'd30', value: 20 } })
  expect(controller.pointerDown('price', { x: 50, y: 30 })).toBe(true)
  expect(record.lines).toEqual([
    {
      id: 'id1',
      pane: 'price',
      timeframe: 'D',
      p1: { date: 'd10', value: 10 },
      p2: { date: 'd50', value: 30 },
      color: '#2962FF',
      width: 2,
      extendRight: false,
      pricedAt: '2020-08-31',
    },
  ])
  expect(record.draft).toBe(null)
  expect(record.toolDone).toBe(1)
  expect(controller.getSelectedId()).toBe('id1')
  expect(record.selected).toBe('id1')
})

test('Should go back to selecting after a line is created', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerUp('price', { x: 10, y: 10 })
  controller.pointerDown('price', { x: 50, y: 30 })
  controller.pointerUp('price', { x: 50, y: 30 })
  expect(controller.pointerDown('price', { x: 300, y: 300 })).toBe(false)
  expect(record.lines).toHaveLength(1)
  expect(record.draft).toBe(null)
})

test('Should create a line by dragging and releasing', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerMove('price', { x: 50, y: 30 })
  controller.pointerUp('price', { x: 50, y: 30 })
  expect(record.lines).toHaveLength(1)
  expect(record.lines[0].p2).toEqual({ date: 'd50', value: 30 })
  expect(record.toolDone).toBe(1)
})

test('Should not create a zero-length line', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerUp('price', { x: 10, y: 10 })
  expect(controller.pointerDown('price', { x: 10, y: 10 })).toBe(true)
  expect(record.lines).toEqual([])
  expect(record.draft).not.toBe(null)
  expect(record.toolDone).toBe(0)
})

test('Should cancel a draft on Escape', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.key('Escape')
  expect(record.lines).toEqual([])
  expect(record.draft).toBe(null)
  expect(record.toolDone).toBe(1)
  expect(controller.pointerDown('price', { x: 60, y: 60 })).toBe(false)
})

test('Should cancel a draft when the cursor tool is chosen', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.setTool('cursor')
  expect(record.draft).toBe(null)
  expect(controller.pointerDown('price', { x: 60, y: 60 })).toBe(false)
  expect(record.lines).toEqual([])
})

test('Should ignore a second point in another pane', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerUp('price', { x: 10, y: 10 })
  controller.pointerMove('rsi', { x: 40, y: 40 })
  expect(controller.pointerDown('rsi', { x: 50, y: 30 })).toBe(true)
  expect(record.lines).toEqual([])
  expect(record.draft).toEqual({ pane: 'price', p1: { date: 'd10', value: 10 }, p2: { date: 'd10', value: 10 } })
})

test('Should draw in the RSI pane with the timeframe it was drawn in', () => {
  const { record, controller } = harness({ timeframe: 'W' })
  controller.setTool('trendline')
  controller.pointerDown('rsi', { x: 10, y: 70 })
  controller.pointerUp('rsi', { x: 10, y: 70 })
  controller.pointerDown('rsi', { x: 90, y: 40 })
  expect(record.lines[0]).toEqual(expect.objectContaining({ pane: 'rsi', timeframe: 'W' }))
})

test('Should not start a line where the pane is not available', () => {
  const { record, controller } = harness({ missingPane: true })
  controller.setTool('trendline')
  expect(controller.pointerDown('rsi', { x: 10, y: 10 })).toBe(false)
  expect(record.draft).toBe(null)
})

test('Should select on the body and release the gesture on empty space', () => {
  const { record, controller } = harness({ lines: [line()] })
  expect(controller.pointerDown('price', { x: 50, y: 3 })).toBe(true)
  controller.pointerUp('price', { x: 50, y: 3 })
  expect(record.selected).toBe('a')
  expect(record.emitted).toBe(0)
  expect(controller.pointerDown('price', { x: 50, y: 80 })).toBe(false)
  expect(record.selected).toBe(null)
  expect(controller.getSelectedId()).toBe(null)
})

test('Should pick the line drawn last when two overlap', () => {
  const { record, controller } = harness({ lines: [line({ id: 'under' }), line({ id: 'over' })] })
  controller.pointerDown('price', { x: 50, y: 0 })
  expect(record.selected).toBe('over')
})

test('Should drag one end', () => {
  const { record, controller } = harness({ lines: [line()] })
  expect(controller.pointerDown('price', { x: 100, y: 0 })).toBe(true)
  controller.pointerMove('price', { x: 120, y: 40 })
  controller.pointerUp('price', { x: 120, y: 40 })
  expect(record.lines[0].p2).toEqual({ date: 'd120', value: 40 })
  expect(record.lines[0].p1).toEqual({ date: 'd0', value: 0 })
})

test('Should drag the whole line', () => {
  const { record, controller } = harness({ lines: [line()] })
  controller.pointerDown('price', { x: 50, y: 0 })
  controller.pointerMove('price', { x: 60, y: 10 })
  controller.pointerMove('price', { x: 70, y: 25 })
  controller.pointerUp('price', { x: 70, y: 25 })
  expect(record.lines[0].p1).toEqual({ date: 'd20', value: 25 })
  expect(record.lines[0].p2).toEqual({ date: 'd120', value: 25 })
})

test('Should stop dragging once the pointer is released', () => {
  const { record, controller } = harness({ lines: [line()] })
  controller.pointerDown('price', { x: 50, y: 0 })
  controller.pointerUp('price', { x: 50, y: 0 })
  controller.pointerMove('price', { x: 90, y: 90 })
  expect(record.emitted).toBe(0)
  expect(record.lines[0].p1).toEqual({ date: 'd0', value: 0 })
})

test('Should refresh pricedAt when a line is edited', () => {
  const { record, controller } = harness({ lines: [line()] })
  controller.pointerDown('price', { x: 100, y: 0 })
  controller.pointerMove('price', { x: 110, y: 5 })
  controller.pointerUp('price', { x: 110, y: 5 })
  expect(record.lines[0].pricedAt).toBe('2020-08-31')
})

test('Should delete the selected line', () => {
  const { record, controller } = harness({ lines: [line(), line({ id: 'b', p1: { date: 'd0', value: 200 }, p2: { date: 'd100', value: 200 } })] })
  controller.select('a')
  controller.key('Delete')
  expect(record.lines.map((item) => item.id)).toEqual(['b'])
  expect(record.selected).toBe(null)
})

test('Should do nothing on Delete without a selection', () => {
  const { record, controller } = harness({ lines: [line()] })
  controller.key('Delete')
  expect(record.emitted).toBe(0)
})

test('Should deselect on Escape when nothing is being drawn', () => {
  const { record, controller } = harness({ lines: [line()] })
  controller.select('a')
  controller.key('Escape')
  expect(record.selected).toBe(null)
  expect(record.toolDone).toBe(0)
})

test('Should ignore lines of the other pane', () => {
  const { controller } = harness({ lines: [line({ pane: 'rsi' })] })
  expect(controller.pointerDown('price', { x: 50, y: 0 })).toBe(false)
  expect(controller.pointerDown('rsi', { x: 50, y: 0 })).toBe(true)
})

test('Should ignore RSI lines of another timeframe', () => {
  const { controller } = harness({ lines: [line({ pane: 'rsi', timeframe: 'W' })], timeframe: 'D' })
  expect(controller.pointerDown('rsi', { x: 50, y: 0 })).toBe(false)
})

test('Should ignore RSI lines while the RSI is hidden', () => {
  const { controller } = harness({ lines: [line({ pane: 'rsi' })], rsiVisible: false })
  expect(controller.pointerDown('rsi', { x: 50, y: 0 })).toBe(false)
})

test('Should keep hidden lines when emitting changes', () => {
  const hidden = line({ id: 'hidden', pane: 'rsi', timeframe: 'W' })
  const { record, controller } = harness({ lines: [line(), hidden], timeframe: 'D' })
  controller.select('a')
  controller.key('Delete')
  expect(record.lines).toEqual([hidden])
})

test('Should hit the extension of a line that extends right', () => {
  const { controller } = harness({ lines: [line({ extendRight: true })] })
  expect(controller.pointerDown('price', { x: 300, y: 0 })).toBe(true)
  const plain = harness({ lines: [line()] })
  expect(plain.controller.pointerDown('price', { x: 300, y: 0 })).toBe(false)
})

test('Should report the cursor for each situation', () => {
  const { controller } = harness({ lines: [line()] })
  expect(controller.pointerMove('price', { x: 50, y: 0 })).toBe('pointer')
  expect(controller.pointerMove('price', { x: 50, y: 90 })).toBe('default')
  controller.pointerDown('price', { x: 50, y: 0 })
  expect(controller.pointerMove('price', { x: 55, y: 5 })).toBe('grabbing')
  controller.pointerUp('price', { x: 55, y: 5 })
  controller.setTool('trendline')
  expect(controller.pointerMove('price', { x: 50, y: 90 })).toBe('crosshair')
})

test('Should not delete a selected line that can no longer be seen', () => {
  const { record, controller, options } = harness({ lines: [line({ pane: 'rsi', timeframe: 'D' })], timeframe: 'D' })
  controller.select('a')
  options.timeframe = 'W'
  controller.key('Delete')
  expect(record.lines).toHaveLength(1)
  expect(record.emitted).toBe(0)
})

test('Should drop the selection when its line stops being visible', () => {
  const { record, controller, options } = harness({ lines: [line({ pane: 'rsi', timeframe: 'D' })] })
  controller.select('a')
  options.rsiVisible = false
  controller.syncVisibility()
  expect(record.selected).toBe(null)
  expect(controller.getSelectedId()).toBe(null)
})

test('Should keep the selection of a line that is still visible', () => {
  const { record, controller, options } = harness({ lines: [line()] })
  controller.select('a')
  options.timeframe = 'W'
  controller.syncVisibility()
  expect(record.selected).toBe('a')
})

test('Should say which lines are visible', () => {
  expect(isLineVisible(line(), 'W', false)).toBe(true)
  expect(isLineVisible(line({ pane: 'rsi', timeframe: 'D' }), 'D', true)).toBe(true)
  expect(isLineVisible(line({ pane: 'rsi', timeframe: 'D' }), 'W', true)).toBe(false)
  expect(isLineVisible(line({ pane: 'rsi', timeframe: 'D' }), 'D', false)).toBe(false)
})

test('Should not start a line where the pane has no values', () => {
  const { record, controller } = harness({ noValues: true })
  controller.setTool('trendline')
  expect(controller.pointerDown('rsi', { x: 10, y: 10 })).toBe(false)
  expect(record.draft).toBe(null)
})

test('Should not finish a line on a position without a value', () => {
  const { record, controller, options } = harness()
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerUp('price', { x: 10, y: 10 })
  options.noValues = true
  controller.pointerMove('price', { x: 40, y: 40 })
  expect(controller.pointerDown('price', { x: 50, y: 30 })).toBe(true)
  controller.pointerUp('price', { x: 90, y: 90 })
  expect(record.lines).toEqual([])
  expect(record.draft).toEqual({ pane: 'price', p1: { date: 'd10', value: 10 }, p2: { date: 'd10', value: 10 } })
})

test('Should not move a line to a position without a value', () => {
  const { record, controller, options } = harness({ lines: [line()] })
  controller.pointerDown('price', { x: 100, y: 0 })
  options.noValues = true
  controller.pointerMove('price', { x: 120, y: 40 })
  expect(record.emitted).toBe(0)
})

test('Should keep the dates of a line that only moves up or down', () => {
  const drawn = line({ p1: { date: 'd3', value: 0 }, p2: { date: 'd101', value: 0 } })
  const { record, controller } = harness({ lines: [drawn], weekly: true })
  controller.pointerDown('price', { x: 50, y: 0 })
  controller.pointerMove('price', { x: 50, y: 20 })
  controller.pointerUp('price', { x: 50, y: 20 })
  expect(record.lines[0].p1).toEqual({ date: 'd3', value: 20 })
  expect(record.lines[0].p2).toEqual({ date: 'd101', value: 20 })
})

test('Should keep the date of an end that stays on its bar', () => {
  const drawn = line({ p1: { date: 'd3', value: 0 }, p2: { date: 'd101', value: 0 } })
  const { record, controller } = harness({ lines: [drawn], weekly: true })
  controller.pointerDown('price', { x: 98, y: 0 })
  controller.pointerMove('price', { x: 99, y: 30 })
  controller.pointerUp('price', { x: 99, y: 30 })
  expect(record.lines[0].p2).toEqual({ date: 'd101', value: 30 })
})

test('Should take the date of the bar a line is moved to', () => {
  const drawn = line({ p1: { date: 'd3', value: 0 }, p2: { date: 'd101', value: 0 } })
  const { record, controller } = harness({ lines: [drawn], weekly: true })
  controller.pointerDown('price', { x: 50, y: 0 })
  controller.pointerMove('price', { x: 57, y: 0 })
  controller.pointerUp('price', { x: 57, y: 0 })
  expect(record.lines[0].p1).toEqual({ date: 'd7', value: 0 })
  expect(record.lines[0].p2).toEqual({ date: 'd105', value: 0 })
})

test('Should return to the cursor on Escape while the tool is armed', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  controller.key('Escape')
  expect(record.toolDone).toBe(1)
  expect(controller.pointerDown('price', { x: 60, y: 60 })).toBe(false)
  expect(record.draft).toBe(null)
})

test('Should put a dragged line back when the gesture is cancelled', () => {
  const drawn = line()
  const { record, controller } = harness({ lines: [drawn] })
  controller.pointerDown('price', { x: 50, y: 0 })
  controller.pointerMove('price', { x: 70, y: 25 })
  controller.cancel()
  expect(record.lines).toEqual([drawn])
  const emitted = record.emitted
  controller.pointerMove('price', { x: 90, y: 90 })
  expect(record.emitted).toBe(emitted)
})

test('Should not emit when a gesture that moved nothing is cancelled', () => {
  const { record, controller } = harness({ lines: [line()] })
  controller.pointerDown('price', { x: 50, y: 0 })
  controller.cancel()
  expect(record.emitted).toBe(0)
  expect(controller.pointerMove('price', { x: 50, y: 90 })).toBe('default')
})

test('Should keep a draft when the gesture is cancelled', () => {
  const { record, controller } = harness()
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.cancel()
  expect(record.draft).not.toBe(null)
  controller.pointerDown('price', { x: 50, y: 30 })
  expect(record.lines).toHaveLength(1)
})

const base = { id: 'a', pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 2, pricedAt: '2020-01-01' }

const hline = (over: Partial<HorizontalLine> = {}): HorizontalLine => ({ ...base, kind: 'hline', value: 120, ...over })

const channel = (over: Partial<Channel> = {}): Channel => ({
  ...base,
  kind: 'channel',
  p1: { date: 'd100', value: 100 },
  p2: { date: 'd300', value: 200 },
  offset: 40,
  ...over,
})

const rect = (over: Partial<Rectangle> = {}): Rectangle => ({
  ...base,
  kind: 'rect',
  p1: { date: 'd100', value: 100 },
  p2: { date: 'd300', value: 200 },
  ...over,
})

test('Should place a horizontal line with one click and return to the cursor', () => {
  const { record, controller } = harness()
  controller.setTool('hline')
  expect(controller.pointerMove('price', { x: 40, y: 90 })).toBe('crosshair')
  expect(controller.pointerDown('price', { x: 40, y: 90 })).toBe(true)
  expect(record.lines).toEqual([
    { kind: 'hline', id: 'id1', pane: 'price', timeframe: 'D', value: 90, color: '#2962FF', width: 2, pricedAt: '2020-08-31' },
  ])
  expect(record.selected).toBe('id1')
  expect(record.toolDone).toBe(1)
  expect(record.draft).toBe(null)
  controller.pointerUp('price', { x: 40, y: 90 })
  expect(controller.pointerDown('price', { x: 300, y: 300 })).toBe(false)
  expect(record.lines).toHaveLength(1)
})

test('Should not place a horizontal line where the pane has no values', () => {
  const { record, controller } = harness({ noValues: true })
  controller.setTool('hline')
  expect(controller.pointerDown('price', { x: 40, y: 90 })).toBe(false)
  expect(record.lines).toEqual([])
})

test('Should move a horizontal line by dragging it anywhere along its length', () => {
  const { record, controller } = harness({ lines: [hline()] })
  expect(controller.pointerMove('price', { x: 20, y: 122 })).toBe('pointer')
  expect(controller.pointerDown('price', { x: 20, y: 122 })).toBe(true)
  expect(controller.pointerMove('price', { x: 60, y: 152 })).toBe('grabbing')
  controller.pointerUp('price', { x: 60, y: 152 })
  expect(record.lines).toEqual([hline({ value: 150, pricedAt: '2020-08-31' })])
  expect(record.selected).toBe('a')
})

test('Should create a rectangle with two clicks', () => {
  const { record, controller } = harness()
  controller.setTool('rect')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerUp('price', { x: 10, y: 10 })
  controller.pointerMove('price', { x: 30, y: 20 })
  expect(record.draft).toEqual({ pane: 'price', kind: 'rect', p1: { date: 'd10', value: 10 }, p2: { date: 'd30', value: 20 } })
  controller.pointerDown('price', { x: 50, y: 30 })
  expect(record.lines).toEqual([
    {
      kind: 'rect',
      id: 'id1',
      pane: 'price',
      timeframe: 'D',
      p1: { date: 'd10', value: 10 },
      p2: { date: 'd50', value: 30 },
      color: '#2962FF',
      width: 2,
      pricedAt: '2020-08-31',
    },
  ])
  expect(record.draft).toBe(null)
  expect(record.toolDone).toBe(1)
})

test('Should create a rectangle by pressing, dragging and releasing', () => {
  const { record, controller } = harness()
  controller.setTool('rect')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerMove('price', { x: 60, y: 40 })
  controller.pointerUp('price', { x: 60, y: 40 })
  expect(record.lines).toHaveLength(1)
  expect(record.lines[0]).toMatchObject({ kind: 'rect', p1: { date: 'd10', value: 10 }, p2: { date: 'd60', value: 40 } })
})

test('Should resize a rectangle from a corner and move it by a side', () => {
  const { record, controller } = harness({ lines: [rect()] })
  controller.pointerDown('price', { x: 100, y: 200 })
  controller.pointerMove('price', { x: 90, y: 220 })
  controller.pointerUp('price', { x: 90, y: 220 })
  expect(record.lines[0]).toMatchObject({ p1: { date: 'd90', value: 100 }, p2: { date: 'd300', value: 220 } })
  controller.pointerDown('price', { x: 200, y: 100 })
  controller.pointerMove('price', { x: 210, y: 110 })
  controller.pointerUp('price', { x: 210, y: 110 })
  expect(record.lines[0]).toMatchObject({ p1: { date: 'd100', value: 110 }, p2: { date: 'd310', value: 230 } })
})

test('Should leave a press inside a rectangle to the chart', () => {
  const { record, controller } = harness({ lines: [rect()] })
  expect(controller.pointerDown('price', { x: 200, y: 150 })).toBe(false)
  expect(record.selected).toBe(null)
})

test('Should create a channel with three clicks: the base line and then its width', () => {
  const { record, controller } = harness()
  controller.setTool('channel')
  controller.pointerDown('price', { x: 100, y: 100 })
  controller.pointerUp('price', { x: 100, y: 100 })
  controller.pointerMove('price', { x: 200, y: 150 })
  expect(record.draft).toEqual({
    pane: 'price',
    kind: 'channel',
    p1: { date: 'd100', value: 100 },
    p2: { date: 'd200', value: 150 },
    offset: 0,
  })
  expect(controller.pointerDown('price', { x: 300, y: 200 })).toBe(true)
  controller.pointerUp('price', { x: 300, y: 200 })
  expect(record.lines).toEqual([])
  expect(controller.pointerMove('price', { x: 200, y: 190 })).toBe('crosshair')
  expect(record.draft).toEqual({
    pane: 'price',
    kind: 'channel',
    p1: { date: 'd100', value: 100 },
    p2: { date: 'd300', value: 200 },
    offset: 40,
  })
  expect(controller.pointerDown('price', { x: 200, y: 110 })).toBe(true)
  expect(record.lines).toEqual([
    {
      kind: 'channel',
      id: 'id1',
      pane: 'price',
      timeframe: 'D',
      p1: { date: 'd100', value: 100 },
      p2: { date: 'd300', value: 200 },
      offset: -40,
      color: '#2962FF',
      width: 2,
      pricedAt: '2020-08-31',
    },
  ])
  expect(record.draft).toBe(null)
  expect(record.selected).toBe('id1')
  expect(record.toolDone).toBe(1)
})

test('Should not take a base line of no length for a channel', () => {
  const { record, controller } = harness()
  controller.setTool('channel')
  controller.pointerDown('price', { x: 100, y: 100 })
  controller.pointerUp('price', { x: 100, y: 100 })
  controller.pointerDown('price', { x: 100, y: 100 })
  controller.pointerUp('price', { x: 100, y: 100 })
  controller.pointerMove('price', { x: 200, y: 150 })
  expect(record.draft).toMatchObject({ p2: { date: 'd200', value: 150 }, offset: 0 })
  expect(record.lines).toEqual([])
})

test('Should drop a channel that is still being drawn on Escape', () => {
  const { record, controller } = harness()
  controller.setTool('channel')
  controller.pointerDown('price', { x: 100, y: 100 })
  controller.pointerUp('price', { x: 100, y: 100 })
  controller.pointerDown('price', { x: 300, y: 200 })
  controller.pointerUp('price', { x: 300, y: 200 })
  controller.key('Escape')
  expect(record.draft).toBe(null)
  expect(record.lines).toEqual([])
  expect(record.toolDone).toBe(1)
  expect(controller.pointerDown('price', { x: 200, y: 110 })).toBe(false)
})

test('Should change the width of a channel by its parallel line and move it by either line', () => {
  const { record, controller } = harness({ lines: [channel()] })
  controller.pointerDown('price', { x: 200, y: 190 })
  controller.pointerMove('price', { x: 200, y: 210 })
  controller.pointerUp('price', { x: 200, y: 210 })
  expect(record.lines[0]).toMatchObject({ p1: { date: 'd100', value: 100 }, p2: { date: 'd300', value: 200 }, offset: 60 })
  controller.pointerDown('price', { x: 150, y: 185 })
  controller.pointerMove('price', { x: 160, y: 195 })
  controller.pointerUp('price', { x: 160, y: 195 })
  expect(record.lines[0]).toMatchObject({ p1: { date: 'd110', value: 110 }, p2: { date: 'd310', value: 210 }, offset: 60 })
})

test('Should delete any kind of drawing that is selected', () => {
  const { record, controller } = harness({ lines: [hline({ id: 'h' }), rect({ id: 'r' }), channel({ id: 'c' })] })
  controller.select('r')
  controller.key('Delete')
  expect(record.lines.map((drawing) => drawing.id)).toEqual(['h', 'c'])
  controller.select('h')
  controller.key('Delete')
  expect(record.lines.map((drawing) => drawing.id)).toEqual(['c'])
})

test('Should put a moved drawing of any kind back when the gesture is cancelled', () => {
  const { record, controller } = harness({ lines: [hline()] })
  controller.pointerDown('price', { x: 20, y: 120 })
  controller.pointerMove('price', { x: 20, y: 160 })
  controller.cancel()
  expect(record.lines).toEqual([hline()])
})

test('Should hide the new drawings of the RSI pane outside their timeframe like it does with lines', () => {
  expect(isLineVisible(hline({ pane: 'rsi', timeframe: 'D' }), 'W', true)).toBe(false)
  expect(isLineVisible(hline({ pane: 'rsi', timeframe: 'D' }), 'D', true)).toBe(true)
  expect(isLineVisible(rect({ timeframe: 'D' }), 'M', true)).toBe(true)
})

test('Should not take a vertical base line for a channel', () => {
  const { record, controller } = harness()
  controller.setTool('channel')
  controller.pointerDown('price', { x: 100, y: 100 })
  controller.pointerUp('price', { x: 100, y: 100 })
  controller.pointerDown('price', { x: 100, y: 180 })
  controller.pointerUp('price', { x: 100, y: 180 })
  controller.pointerMove('price', { x: 200, y: 150 })
  expect(record.draft).toMatchObject({ p2: { date: 'd200', value: 150 }, offset: 0 })
})

test('Should keep an alert that was disarmed while its line was being dragged', () => {
  const armed = hline({ alert: true })
  const { record, controller } = harness({ lines: [armed] })
  controller.pointerDown('price', { x: 20, y: 120 })
  controller.pointerMove('price', { x: 20, y: 130 })
  record.lines = record.lines.map((drawing) => {
    const { alert: _alert, ...quiet } = drawing
    return quiet
  }) as TrendLine[]
  controller.pointerMove('price', { x: 20, y: 150 })
  expect(record.lines).toEqual([hline({ value: 150, pricedAt: '2020-08-31' })])
})

test('Should not arm an alert again when a drag is cancelled after it was disarmed', () => {
  const armed = hline({ alert: true })
  const { record, controller } = harness({ lines: [armed] })
  controller.pointerDown('price', { x: 20, y: 120 })
  controller.pointerMove('price', { x: 20, y: 130 })
  record.lines = record.lines.map((drawing) => {
    const { alert: _alert, ...quiet } = drawing
    return quiet
  }) as TrendLine[]
  controller.cancel()
  expect(record.lines).toEqual([hline()])
})

test('Should draw each new shape with the look remembered for its kind', () => {
  const white = { color: '#FFFFFF', width: 1, lineStyle: 'dashed' as const, opacity: 0.5, hidePrice: true as const }
  const red = { color: '#F23645', width: 3, lineStyle: 'dotted' as const }
  const { record, controller } = harness({ looks: { hline: white, trend: red } })
  controller.setTool('hline')
  controller.pointerDown('price', { x: 40, y: 90 })
  controller.setTool('trendline')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerDown('price', { x: 50, y: 30 })
  controller.setTool('rect')
  controller.pointerDown('price', { x: 10, y: 10 })
  controller.pointerDown('price', { x: 50, y: 30 })
  const [hline, trend, rect] = record.lines as Drawing[]
  expect(hline).toMatchObject({ kind: 'hline', ...white })
  expect(trend).toMatchObject(red)
  expect(trend).not.toHaveProperty('hidePrice')
  expect(rect).toMatchObject({ kind: 'rect', color: '#2962FF', width: 2 })
  expect(rect).not.toHaveProperty('lineStyle')
})

test('Should measure between two clicks, keep the measure on screen and go back to the cursor without drawing anything', () => {
  const { record, controller } = harness()
  controller.setTool('measure')
  expect(controller.pointerDown('price', { x: 10, y: 100 })).toBe(true)
  controller.pointerUp('price', { x: 10, y: 100 })
  expect(controller.pointerMove('price', { x: 40, y: 130 })).toBe('crosshair')
  expect(record.measure).toEqual({ pane: 'price', p1: { date: 'd10', value: 100 }, p2: { date: 'd40', value: 130 } })
  expect(controller.pointerDown('price', { x: 60, y: 150 })).toBe(true)
  expect(record.measure).toEqual({ pane: 'price', p1: { date: 'd10', value: 100 }, p2: { date: 'd60', value: 150 } })
  expect(record.toolDone).toBe(1)
  expect(record.lines).toEqual([])
  controller.pointerMove('price', { x: 90, y: 190 })
  expect(record.measure?.p2).toEqual({ date: 'd60', value: 150 })
})

test('Should measure by dragging and releasing', () => {
  const { record, controller } = harness()
  controller.setTool('measure')
  controller.pointerDown('price', { x: 10, y: 100 })
  controller.pointerMove('price', { x: 50, y: 80 })
  controller.pointerUp('price', { x: 50, y: 80 })
  expect(record.measure).toEqual({ pane: 'price', p1: { date: 'd10', value: 100 }, p2: { date: 'd50', value: 80 } })
  expect(record.toolDone).toBe(1)
})

test('Should clear a measure with the next click or with Escape', () => {
  const { record, controller } = harness()
  controller.setTool('measure')
  controller.pointerDown('price', { x: 10, y: 100 })
  controller.pointerDown('price', { x: 60, y: 150 })
  controller.setTool('cursor')
  controller.pointerDown('price', { x: 300, y: 300 })
  expect(record.measure).toBeNull()
  controller.setTool('measure')
  controller.pointerDown('price', { x: 10, y: 100 })
  controller.key('Escape')
  expect(record.measure).toBeNull()
})

test('Should measure only on the price pane', () => {
  const { record, controller } = harness()
  controller.setTool('measure')
  expect(controller.pointerDown('rsi', { x: 10, y: 50 })).toBe(false)
  expect(record.measure).toBeNull()
})
