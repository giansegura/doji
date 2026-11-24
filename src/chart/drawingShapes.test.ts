import { expect, test } from 'vitest'
import type { Channel, HorizontalLine, Rectangle, TrendLine } from '../../shared/types'
import { type ShapeGeometry, hitTestOutline, moveDrawing, offsetAt, outlineOf } from './drawingShapes'

const geometry: ShapeGeometry = {
  toPoint: ({ x, y }) => ({ date: `d${Math.round(x)}`, value: y }),
  toXY: (point) => ({ x: Number(point.date.slice(1)), y: point.value }),
  toY: (value) => value,
  width: 500,
}

const blind: ShapeGeometry = { ...geometry, toXY: () => null, toY: () => null }

const base = { id: 'a', pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 2, pricedAt: '2020-01-01' }

const trend: TrendLine = { ...base, p1: { date: 'd100', value: 50 }, p2: { date: 'd200', value: 50 }, extendRight: false }
const hline: HorizontalLine = { ...base, kind: 'hline', value: 120 }
const channel: Channel = { ...base, kind: 'channel', p1: { date: 'd100', value: 100 }, p2: { date: 'd300', value: 200 }, offset: 40 }
const rect: Rectangle = { ...base, kind: 'rect', p1: { date: 'd100', value: 100 }, p2: { date: 'd300', value: 200 } }

test('Should outline a trend line as one segment with a handle at each end', () => {
  expect(outlineOf(trend, geometry)).toEqual({
    segments: [[{ x: 100, y: 50 }, { x: 200, y: 50 }]],
    fill: null,
    handles: [
      { part: 'p1', at: { x: 100, y: 50 } },
      { part: 'p2', at: { x: 200, y: 50 } },
    ],
  })
})

test('Should add the stretch to the right edge of a trend line that extends', () => {
  const outline = outlineOf({ ...trend, extendRight: true }, geometry)
  expect(outline?.segments).toEqual([
    [{ x: 100, y: 50 }, { x: 200, y: 50 }],
    [{ x: 200, y: 50 }, { x: 500, y: 50 }],
  ])
})

test('Should outline a horizontal line across the whole pane with a handle in the middle', () => {
  expect(outlineOf(hline, geometry)).toEqual({
    segments: [[{ x: 0, y: 120 }, { x: 500, y: 120 }]],
    fill: null,
    handles: [{ part: 'level', at: { x: 250, y: 120 } }],
  })
})

test('Should outline a channel as two parallel lines, the band between them and three handles', () => {
  expect(outlineOf(channel, geometry)).toEqual({
    segments: [
      [{ x: 100, y: 100 }, { x: 300, y: 200 }],
      [{ x: 100, y: 140 }, { x: 300, y: 240 }],
    ],
    fill: [{ x: 100, y: 100 }, { x: 300, y: 200 }, { x: 300, y: 240 }, { x: 100, y: 140 }],
    handles: [
      { part: 'p1', at: { x: 100, y: 100 } },
      { part: 'p2', at: { x: 300, y: 200 } },
      { part: 'offset', at: { x: 200, y: 190 } },
    ],
  })
})

test('Should outline a rectangle as four sides, its area and a handle at each corner', () => {
  const outline = outlineOf(rect, geometry)
  expect(outline?.segments).toHaveLength(4)
  expect(outline?.fill).toEqual([{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 200 }, { x: 100, y: 200 }])
  expect(outline?.handles).toEqual([
    { part: 'p1', at: { x: 100, y: 100 } },
    { part: 'p2', at: { x: 300, y: 200 } },
    { part: 'q1', at: { x: 100, y: 200 } },
    { part: 'q2', at: { x: 300, y: 100 } },
  ])
})

test('Should outline nothing where the pane cannot place the drawing', () => {
  ;[trend, hline, channel, rect].forEach((drawing) => expect(outlineOf(drawing, blind)).toBeNull())
})

test('Should tell a handle from the body and from a miss', () => {
  const outline = outlineOf(channel, geometry)
  expect(outline && hitTestOutline({ x: 102, y: 101 }, outline)).toBe('p1')
  expect(outline && hitTestOutline({ x: 200, y: 190 }, outline)).toBe('offset')
  expect(outline && hitTestOutline({ x: 150, y: 127 }, outline)).toBe('body')
  expect(outline && hitTestOutline({ x: 250, y: 216 }, outline)).toBe('body')
  expect(outline && hitTestOutline({ x: 200, y: 400 }, outline)).toBeNull()
})

test('Should not count the inside of a rectangle or a channel as a hit', () => {
  const box = outlineOf(rect, geometry)
  const band = outlineOf(channel, geometry)
  expect(box && hitTestOutline({ x: 200, y: 150 }, box)).toBeNull()
  expect(band && hitTestOutline({ x: 200, y: 170 }, band)).toBeNull()
  expect(box && hitTestOutline({ x: 200, y: 102 }, box)).toBe('body')
})

test('Should measure how far a position is from the base line of a channel', () => {
  expect(offsetAt(geometry, channel.p1, channel.p2, { x: 200, y: 190 })).toBe(40)
  expect(offsetAt(geometry, channel.p1, channel.p2, { x: 100, y: 70 })).toBe(-30)
  expect(offsetAt(blind, channel.p1, channel.p2, { x: 200, y: 190 })).toBeNull()
})

test('Should move one end of a trend line and leave the other', () => {
  expect(moveDrawing(geometry, trend, 'p2', { x: 200, y: 50 }, { x: 220, y: 80 })).toEqual({
    ...trend,
    p2: { date: 'd220', value: 80 },
  })
})

test('Should move a whole trend line by its body', () => {
  expect(moveDrawing(geometry, trend, 'body', { x: 150, y: 50 }, { x: 160, y: 70 })).toEqual({
    ...trend,
    p1: { date: 'd110', value: 70 },
    p2: { date: 'd210', value: 70 },
  })
})

test('Should move a horizontal line up and down from wherever it is grabbed', () => {
  expect(moveDrawing(geometry, hline, 'body', { x: 40, y: 122 }, { x: 300, y: 152 })).toEqual({ ...hline, value: 150 })
  expect(moveDrawing(geometry, hline, 'level', { x: 250, y: 120 }, { x: 250, y: 100 })).toEqual({ ...hline, value: 100 })
})

test('Should widen or narrow a channel by its parallel line and leave its base alone', () => {
  expect(moveDrawing(geometry, channel, 'offset', { x: 200, y: 190 }, { x: 200, y: 110 })).toEqual({ ...channel, offset: -40 })
})

test('Should move one end of the base of a channel and keep its width', () => {
  expect(moveDrawing(geometry, channel, 'p1', { x: 100, y: 100 }, { x: 80, y: 90 })).toEqual({
    ...channel,
    p1: { date: 'd80', value: 90 },
  })
})

test('Should move a whole channel by either of its lines', () => {
  expect(moveDrawing(geometry, channel, 'body', { x: 150, y: 165 }, { x: 160, y: 175 })).toEqual({
    ...channel,
    p1: { date: 'd110', value: 110 },
    p2: { date: 'd310', value: 210 },
  })
})

test('Should resize a rectangle from each of its four corners', () => {
  expect(moveDrawing(geometry, rect, 'p1', { x: 100, y: 100 }, { x: 90, y: 80 })).toEqual({
    ...rect,
    p1: { date: 'd90', value: 80 },
  })
  expect(moveDrawing(geometry, rect, 'q1', { x: 100, y: 200 }, { x: 90, y: 220 })).toEqual({
    ...rect,
    p1: { date: 'd90', value: 100 },
    p2: { date: 'd300', value: 220 },
  })
  expect(moveDrawing(geometry, rect, 'q2', { x: 300, y: 100 }, { x: 320, y: 80 })).toEqual({
    ...rect,
    p1: { date: 'd100', value: 80 },
    p2: { date: 'd320', value: 200 },
  })
})

test('Should move a whole rectangle by any of its sides', () => {
  expect(moveDrawing(geometry, rect, 'body', { x: 200, y: 100 }, { x: 210, y: 130 })).toEqual({
    ...rect,
    p1: { date: 'd110', value: 130 },
    p2: { date: 'd310', value: 230 },
  })
})

test('Should not move a drawing to where the pane has no values', () => {
  const valueless: ShapeGeometry = { ...geometry, toPoint: () => null }
  ;[trend, hline, channel, rect].forEach((drawing) =>
    expect(moveDrawing(valueless, drawing, 'body', { x: 0, y: 0 }, { x: 10, y: 10 })).toBeNull(),
  )
})
