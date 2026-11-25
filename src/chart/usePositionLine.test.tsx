import { renderHook } from '@testing-library/react'
import { LineStyle } from 'lightweight-charts'
import { expect, test, vi } from 'vitest'
import type { ChartHandles } from './useChart'
import { positionLineOptions, usePositionLine } from './usePositionLine'

const colors = { up: '#0f0', down: '#f00' }

test('Should draw the line at the average price with the gain beside it, in the colour of the gain', () => {
  expect(positionLineOptions({ quantity: 100, price: 50 }, 55, 'USD', colors)).toEqual({
    price: 50,
    color: '#0f0',
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: '+10.00% +$500',
  })
  expect(positionLineOptions({ quantity: 100, price: 50 }, 45, 'USD', colors).color).toBe('#f00')
  expect(positionLineOptions({ quantity: 100, price: 50 }, null, 'USD', colors).title).toBe('100 shares')
})

test('Should add the line, keep its gain up to date and take it away with the position', () => {
  const line = { applyOptions: vi.fn() }
  const main = { createPriceLine: vi.fn(() => line), removePriceLine: vi.fn() }
  const handles = { main, isAlive: () => true } as unknown as ChartHandles
  const { rerender } = renderHook(({ holding, price }) => usePositionLine({ handles, holding, price, currency: 'USD', colors }), {
    initialProps: { holding: { quantity: 100, price: 50 } as { quantity: number; price: number } | undefined, price: 55 },
  })
  expect(main.createPriceLine).toHaveBeenCalledTimes(1)
  rerender({ holding: { quantity: 100, price: 50 }, price: 60 })
  expect(line.applyOptions).toHaveBeenLastCalledWith(expect.objectContaining({ title: '+20.00% +$1,000' }))
  rerender({ holding: undefined, price: 60 })
  expect(main.removePriceLine).toHaveBeenCalledWith(line)
})
