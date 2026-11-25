import { expect, test } from 'vitest'
import type { Drawing } from '../../shared/types'
import { createLevelsPrimitive, levelsToShow } from './levelsPrimitive'

const hline = (value: number): Drawing => ({
  kind: 'hline',
  id: `h${value}`,
  pane: 'price',
  timeframe: 'D',
  value,
  color: '#FFFFFF',
  width: 1,
  pricedAt: '2020-01-01',
})

test('Should leave out the levels that already have a horizontal line of the user', () => {
  expect(levelsToShow([90, 100, 120], [hline(100.05), { ...hline(120), pane: 'rsi' }], 0.01)).toEqual([90, 120])
})

test('Should draw each level as a faint dashed line across the pane, without touching the price axis', () => {
  const calls: string[] = []
  const context = {
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    lineDash: [] as number[],
    setLineDash: (pattern: number[]) => {
      context.lineDash = pattern
    },
    beginPath: () => undefined,
    moveTo: (x: number, y: number) => calls.push(`moveTo ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo ${x},${y}`),
    stroke: () => calls.push(`stroke ${context.strokeStyle} ${context.lineWidth} ${context.globalAlpha} ${context.lineDash.join(',')}`),
    save: () => undefined,
    restore: () => undefined,
  }
  const primitive = createLevelsPrimitive({ prices: () => [100, 120, 999], color: () => '#FFFFFF' })
  primitive.attached?.({
    series: { priceToCoordinate: (price: number) => (price === 999 ? null : 500 - price * 2) },
    requestUpdate: () => undefined,
  } as never)
  const view = primitive.paneViews?.()[0]
  view?.renderer()?.draw({ useMediaCoordinateSpace: (callback: (scope: unknown) => void) => callback({ context, mediaSize: { width: 800, height: 400 } }) } as never)
  expect(calls).toEqual(['moveTo 0,300', 'lineTo 800,300', 'moveTo 0,260', 'lineTo 800,260', 'stroke #FFFFFF 1 0.5 5,4'])
  expect(primitive.priceAxisViews).toBeUndefined()
})
