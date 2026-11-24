import { expect, test } from 'vitest'
import type { Drawing } from '../../shared/types'
import type { ShapeGeometry } from './drawingShapes'
import { draftDrawing, viewOf } from './drawingViews'

const geometry: ShapeGeometry = {
  toPoint: ({ x, y }) => ({ date: `d${Math.round(x)}`, value: y }),
  toXY: (point) => ({ x: Number(point.date.slice(1)), y: point.value }),
  toY: (value) => value,
  width: 500,
}

const base = { id: 'a', pane: 'price' as const, timeframe: 'D' as const, color: '#F23645', width: 3, pricedAt: '2020-01-01' }

const hline: Drawing = { ...base, kind: 'hline', value: 120.5 }
const trend: Drawing = { ...base, p1: { date: 'd100', value: 50 }, p2: { date: 'd200', value: 80 }, extendRight: false }

test('Should paint a drawing with its own colour and width and say whether it is selected', () => {
  expect(viewOf(trend, geometry, true)).toMatchObject({ color: '#F23645', width: 3, selected: true, label: null })
  expect(viewOf(trend, geometry, false)?.selected).toBe(false)
  expect(viewOf(trend, geometry, false)?.segments).toEqual([[{ x: 100, y: 50 }, { x: 200, y: 80 }]])
})

test('Should label a horizontal line with its level on the price axis', () => {
  expect(viewOf(hline, geometry, false)?.label).toEqual({ y: 120.5, text: '120.50' })
})

test('Should paint nothing where the pane cannot place the drawing', () => {
  expect(viewOf(hline, { ...geometry, toY: () => null }, false)).toBeNull()
})

test('Should turn what is being drawn into a drawing of its kind with the default style', () => {
  const style = { timeframe: 'W' as const, color: '#2962FF', width: 2, pricedAt: '2020-08-31' }
  const p1 = { date: 'd10', value: 10 }
  const p2 = { date: 'd30', value: 20 }
  expect(draftDrawing({ pane: 'price', p1, p2 }, style)).toEqual({
    id: 'draft',
    pane: 'price',
    timeframe: 'W',
    color: '#2962FF',
    width: 2,
    pricedAt: '2020-08-31',
    p1,
    p2,
    extendRight: false,
  })
  expect(draftDrawing({ pane: 'rsi', kind: 'rect', p1, p2 }, style)).toMatchObject({ kind: 'rect', pane: 'rsi', p1, p2 })
  expect(draftDrawing({ pane: 'price', kind: 'channel', p1, p2, offset: 7 }, style)).toMatchObject({ kind: 'channel', offset: 7 })
})

test('Should mark an armed horizontal line near the right edge of the pane', () => {
  expect(viewOf({ ...hline, alert: true }, geometry, false)?.alert).toEqual({ x: 486, y: 120.5 })
  expect(viewOf(hline, geometry, false)?.alert).toBeNull()
})

test('Should mark an armed trend line at its right-most end', () => {
  expect(viewOf({ ...trend, alert: true }, geometry, false)?.alert).toEqual({ x: 200, y: 80 })
  expect(viewOf(trend, geometry, false)?.alert).toBeNull()
})

test('Should label a horizontal line of a forex pair with the decimals of forex', () => {
  expect(viewOf({ ...hline, value: 1.096731 }, geometry, false, 'EURUSD=X')?.label?.text).toBe('1.0967')
})
