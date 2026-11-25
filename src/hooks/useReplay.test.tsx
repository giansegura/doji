import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { addWeekdays } from '../../shared/dates'
import type { Bar } from '../../shared/types'
import { useReplay } from './useReplay'

const bars: Bar[] = Array.from({ length: 10 }, (_, index) => ({
  time: addWeekdays('2026-06-01', index),
  open: 1,
  high: 1,
  low: 1,
  close: 1,
  volume: 1,
}))

afterEach(() => {
  vi.useRealTimers()
})

const setup = (symbol = 'AAPL') =>
  renderHook((props: { symbol: string }) => useReplay({ bars, timeframe: 'D', symbol: props.symbol }), { initialProps: { symbol } })

test('Should pick the bar to start from, then step forward one bar at a time', () => {
  const { result } = setup()
  expect(result.current.replay).toEqual({ status: 'off' })
  act(() => result.current.start())
  expect(result.current.replay).toEqual({ status: 'picking' })
  act(() => result.current.pick('2026-06-03'))
  expect(result.current.replay).toEqual({ status: 'on', cutoff: '2026-06-03', playing: false, speed: 1 })
  act(() => result.current.step())
  expect(result.current.replay).toMatchObject({ cutoff: '2026-06-04' })
})

test('Should play by itself at the chosen speed and stop at the last bar', () => {
  vi.useFakeTimers()
  const { result } = setup()
  act(() => result.current.start())
  act(() => result.current.pick('2026-06-10'))
  act(() => result.current.setSpeed(10))
  act(() => result.current.togglePlay())
  act(() => vi.advanceTimersByTime(250))
  expect(result.current.replay).toMatchObject({ cutoff: '2026-06-12', playing: true })
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current.replay).toMatchObject({ cutoff: '2026-06-12', playing: false })
})

test('Should step with the right arrow and leave with Escape', () => {
  const { result } = setup()
  act(() => result.current.start())
  act(() => result.current.pick('2026-06-03'))
  act(() => {
    fireEvent.keyDown(window, { key: 'ArrowRight' })
  })
  expect(result.current.replay).toMatchObject({ cutoff: '2026-06-04' })
  act(() => {
    fireEvent.keyDown(window, { key: 'Escape' })
  })
  expect(result.current.replay).toEqual({ status: 'off' })
})

test('Should leave the replay when the chart changes symbol and ignore a pick on the last bar', () => {
  const { result, rerender } = setup()
  act(() => result.current.start())
  act(() => result.current.pick('2026-06-12'))
  expect(result.current.replay).toEqual({ status: 'picking' })
  act(() => result.current.pick('2026-06-03'))
  rerender({ symbol: 'MSFT' })
  expect(result.current.replay).toEqual({ status: 'off' })
})
