import { expect, test } from 'vitest'
import { createGapsPrimitive } from './gapsPrimitive'

test('Should shade each open gap from its bar to the right edge in the colour of its direction', () => {
  const calls: string[] = []
  const context = {
    fillStyle: '',
    globalAlpha: 1,
    save: () => undefined,
    restore: () => undefined,
    fillRect: (x: number, y: number, width: number, height: number) => calls.push(`rect ${x},${y} ${width}x${height} ${context.fillStyle} ${context.globalAlpha}`),
  }
  const primitive = createGapsPrimitive({
    boxes: () => [
      { x: 100, top: 40, bottom: 60, direction: 'up' },
      { x: 250, top: 90, bottom: 80, direction: 'down' },
    ],
    colors: () => ({ up: '#0f0', down: '#f00' }),
  })
  primitive.paneViews?.()[0].renderer()?.draw({
    useMediaCoordinateSpace: (callback: (scope: unknown) => void) => callback({ context, mediaSize: { width: 400, height: 300 } }),
  } as never)
  expect(calls).toEqual(['rect 100,40 300x20 #0f0 0.14', 'rect 250,80 150x10 #f00 0.14'])
})
