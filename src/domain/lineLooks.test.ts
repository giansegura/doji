import { expect, test } from 'vitest'
import type { Drawing } from '../../shared/types'
import { changedLook, kindOf, lookOf, withLook } from './lineLooks'

const base = { id: 'a', pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 2, pricedAt: '2026-11-23' }
const p1 = { date: '2026-11-02', value: 200 }
const p2 = { date: '2026-11-20', value: 230 }

const hline: Drawing = { ...base, kind: 'hline', value: 210 }
const trend: Drawing = { ...base, p1, p2, extendRight: false }
const channel: Drawing = { ...base, kind: 'channel', p1, p2, offset: 5 }
const rect: Drawing = { ...base, kind: 'rect', p1, p2 }

test('Should tell the kind of every drawing, calling a line without a kind a trend line', () => {
  expect([hline, trend, { ...trend, kind: 'trend' } as Drawing, channel, rect].map(kindOf)).toEqual([
    'hline',
    'trend',
    'trend',
    'channel',
    'rect',
  ])
})

test('Should read the look of a drawing without its place, its text or its alert', () => {
  const styled: Drawing = {
    ...hline,
    color: '#FFFFFF',
    width: 1,
    lineStyle: 'dashed',
    opacity: 0.5,
    hidePrice: true as const,
    alert: true,
    text: 'R1',
  }
  expect(lookOf(styled)).toEqual({ color: '#FFFFFF', width: 1, lineStyle: 'dashed', opacity: 0.5, hidePrice: true })
  expect(lookOf(trend)).toEqual({ color: '#2962FF', width: 2 })
})

test('Should give a new drawing the look remembered for its kind', () => {
  const look = { color: '#FFFFFF', width: 1, lineStyle: 'dotted' as const, opacity: 0.4, hidePrice: true as const }
  expect(withLook(hline, look)).toEqual({ ...hline, ...look })
  expect(withLook(trend, look)).toEqual({ ...trend, color: '#FFFFFF', width: 1, lineStyle: 'dotted', opacity: 0.4 })
})

test('Should drop the stroke and the opacity of a drawing when the look is solid and opaque', () => {
  const styled: Drawing = { ...hline, lineStyle: 'dashed', opacity: 0.5, hidePrice: true as const }
  expect(withLook(styled, { color: '#F23645', width: 3 })).toEqual({ ...hline, color: '#F23645', width: 3 })
})

test('Should tell the new look of a drawing only when its look is what changed', () => {
  expect(changedLook(hline, { ...hline, color: '#FFFFFF' })).toEqual({ color: '#FFFFFF', width: 2 })
  expect(changedLook(hline, { ...hline, lineStyle: 'dashed' })).toEqual({ color: '#2962FF', width: 2, lineStyle: 'dashed' })
  expect(changedLook(hline, { ...hline, alert: true })).toBeNull()
  expect(changedLook(hline, { ...hline, text: 'R1' })).toBeNull()
  expect(changedLook(hline, { ...hline, value: 215 })).toBeNull()
  expect(changedLook({ ...hline, opacity: 0.5 }, hline)).toEqual({ color: '#2962FF', width: 2 })
})
