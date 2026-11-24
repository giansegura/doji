import { expect, test } from 'vitest'
import { type PaneSource, createPaneGeometry } from './paneGeometry'
import { createTimeIndex } from './timeIndex'

const times = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23']

const source = (over: Partial<PaneSource> = {}): PaneSource => ({
  logicalToCoordinate: (index) => 100 + index * 10,
  valueToCoordinate: (value) => 500 - value * 2,
  coordinateToValue: (y) => (500 - y) / 2,
  width: 640,
  timeIndex: createTimeIndex(times, 'D'),
  ...over,
})

test('Should place a point by its date and value', () => {
  const geometry = createPaneGeometry(source())
  expect(geometry?.toXY({ date: '2026-11-19', value: 50 })).toEqual({ x: 130, y: 400 })
  expect(geometry?.width).toBe(640)
})

test('Should read the nearest bar and the value under a position', () => {
  const geometry = createPaneGeometry(source())
  expect(geometry?.toPoint({ x: 134, y: 400 })).toEqual({ date: '2026-11-19', value: 50 })
  expect(geometry?.toPoint({ x: 136, y: 300 })).toEqual({ date: '2026-11-20', value: 100 })
})

test('Should read dates beyond the last bar and place them back', () => {
  const geometry = createPaneGeometry(source())
  const point = geometry?.toPoint({ x: 170, y: 400 })
  expect(point).toEqual({ date: '2026-11-25', value: 50 })
  expect(geometry?.toXY({ date: '2026-11-25', value: 50 })).toEqual({ x: 170, y: 400 })
})

test('Should read dates before the first bar', () => {
  const geometry = createPaneGeometry(source())
  expect(geometry?.toPoint({ x: 80, y: 400 })?.date).toBe('2026-11-12')
})

test('Should not place a point whose value has no position', () => {
  const geometry = createPaneGeometry(source({ valueToCoordinate: () => null }))
  expect(geometry?.toXY({ date: '2026-11-19', value: 50 })).toBe(null)
})

test('Should read no point when a position has no value', () => {
  const geometry = createPaneGeometry(source({ coordinateToValue: () => null }))
  expect(geometry?.toPoint({ x: 130, y: 400 })).toBe(null)
})

test('Should give no geometry while the time scale has no positions', () => {
  expect(createPaneGeometry(source({ logicalToCoordinate: () => null }))).toBe(null)
  expect(createPaneGeometry(source({ logicalToCoordinate: () => 100 }))).toBe(null)
})

test('Should place a value on the vertical axis without needing a date', () => {
  const geometry = createPaneGeometry(source())
  expect(geometry?.toY(50)).toBe(400)
  expect(createPaneGeometry(source({ valueToCoordinate: () => null }))?.toY(50)).toBeNull()
})
