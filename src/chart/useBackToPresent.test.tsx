import { renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { ChartHandles } from './useChart'
import { useBackToPresent } from './useBackToPresent'

const setup = (asOf: string | null) => {
  const scrollToRealTime = vi.fn()
  const handles = { chart: { timeScale: () => ({ scrollToRealTime }) } } as unknown as ChartHandles
  const hook = renderHook(({ date }) => useBackToPresent(handles, date), { initialProps: { date: asOf } })
  return { scrollToRealTime, ...hook }
}

test('Should go back to the latest bar when the replay ends', () => {
  const { scrollToRealTime, rerender } = setup('2026-06-10')
  rerender({ date: '2026-06-11' })
  expect(scrollToRealTime).not.toHaveBeenCalled()
  rerender({ date: null })
  expect(scrollToRealTime).toHaveBeenCalledTimes(1)
  rerender({ date: null })
  expect(scrollToRealTime).toHaveBeenCalledTimes(1)
})

test('Should leave the view alone when there was no replay', () => {
  const { scrollToRealTime, rerender } = setup(null)
  rerender({ date: null })
  expect(scrollToRealTime).not.toHaveBeenCalled()
})
