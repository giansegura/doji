import { expect, test } from 'vitest'
import type { Profile } from './volumeProfile'
import { createVolumeProfilePrimitive } from './volumeProfilePrimitive'

const profile: Profile = {
  rows: [
    { low: 100, high: 101, up: 30, down: 10 },
    { low: 101, high: 102, up: 60, down: 20 },
    { low: 102, high: 103, up: 0, down: 20 },
  ],
  poc: 1,
  valueArea: { from: 0, to: 1 },
}

const paint = (shown: Profile | null) => {
  const calls: string[] = []
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`rect ${x},${y} ${width}x${height} ${context.fillStyle} ${context.globalAlpha}`),
    beginPath: () => undefined,
    moveTo: (x: number, y: number) => calls.push(`moveTo ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo ${x},${y}`),
    stroke: () => calls.push(`stroke ${context.strokeStyle} ${context.globalAlpha}`),
    save: () => undefined,
    restore: () => undefined,
  }
  const primitive = createVolumeProfilePrimitive({
    profile: () => shown,
    colors: () => ({ up: '#3CC68A', down: '#F25C69', poc: '#7C5CFF' }),
  })
  primitive.attached?.({ series: { priceToCoordinate: (price: number) => 400 - (price - 100) * 100 }, requestUpdate: () => undefined } as never)
  const view = primitive.paneViews?.()[0]
  view?.renderer()?.draw({ useMediaCoordinateSpace: (callback: (scope: unknown) => void) => callback({ context, mediaSize: { width: 1000, height: 500 } }) } as never)
  return { calls, zOrder: view?.zOrder?.() }
}

test('Should paint the rows in the colours of rising and falling volume, fainter outside the value area', () => {
  const { calls } = paint(profile)
  expect(calls).toContain('rect 875,301 93.75x98 #3CC68A 0.45')
  expect(calls).toContain('rect 968.75,301 31.25x98 #F25C69 0.45')
  expect(calls).toContain('rect 937.5,101 62.5x98 #F25C69 0.2')
})

test('Should draw the point of control across the pane', () => {
  const { calls } = paint(profile)
  expect(calls).toContain('moveTo 0,250')
  expect(calls).toContain('lineTo 1000,250')
  expect(calls).toContain('stroke #7C5CFF 0.8')
})

test('Should paint nothing without a profile and stay behind the candles', () => {
  const { calls, zOrder } = paint(null)
  expect(calls).toEqual([])
  expect(zOrder).toBe('bottom')
})
