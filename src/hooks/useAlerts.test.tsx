import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Drawing, Quote } from '../../shared/types'
import { useAlerts } from './useAlerts'

const level = (id: string, value: number, alert = true): Drawing => ({
  kind: 'hline',
  id,
  pane: 'price',
  timeframe: 'D',
  value,
  color: '#2962FF',
  width: 2,
  pricedAt: '2020-01-01',
  ...(alert ? { alert: true } : {}),
})

const quoteOf = (symbol: string, price: number): Record<string, Quote> => ({
  [symbol]: { symbol, price, change: 0, changePercent: 0 },
})

const setup = (lines: Record<string, Drawing[]>) => {
  const dispatch = vi.fn()
  const notify = vi.fn()
  const hook = renderHook((props: { quotes: Record<string, Quote> }) => useAlerts({ lines, ...props, dispatch, notify, now: () => new Date(2026, 10, 24, 15, 32) }), {
    initialProps: { quotes: {} },
  })
  return { dispatch, notify, ...hook }
}

test('Should stay quiet while the price does not cross anything', () => {
  const { dispatch, notify, result, rerender } = setup({ KO: [level('a', 100)] })
  rerender({ quotes: quoteOf('KO', 98) })
  rerender({ quotes: quoteOf('KO', 99) })
  expect(notify).not.toHaveBeenCalled()
  expect(dispatch).not.toHaveBeenCalled()
  expect(result.current.fired).toEqual([])
})

test('Should notify, list and disarm an alert when the price crosses it', () => {
  const lines = { KO: [level('a', 100), level('b', 150)] }
  const { dispatch, notify, result, rerender } = setup(lines)
  rerender({ quotes: quoteOf('KO', 99) })
  rerender({ quotes: quoteOf('KO', 101.5) })
  expect(notify).toHaveBeenCalledWith('KO crossed 100.00', 'Up through 100.00, now at 101.50')
  expect(dispatch).toHaveBeenCalledWith({ type: 'setLines', symbol: 'KO', lines: [level('a', 100, false), level('b', 150)] })
  expect(result.current.fired).toEqual([{ id: 'KO:a:1', text: 'KO crossed 100.00 going up', time: '15:32' }])
})

test('Should say when the price crosses going down', () => {
  const { notify, rerender } = setup({ KO: [level('a', 100)] })
  rerender({ quotes: quoteOf('KO', 101) })
  rerender({ quotes: quoteOf('KO', 99.5) })
  expect(notify).toHaveBeenCalledWith('KO crossed 100.00', 'Down through 100.00, now at 99.50')
})

test('Should use the price outside regular hours when there is one', () => {
  const { notify, rerender } = setup({ KO: [level('a', 100)] })
  rerender({ quotes: quoteOf('KO', 99) })
  rerender({ quotes: { KO: { symbol: 'KO', price: 99, change: 0, changePercent: 0, extended: { session: 'post', price: 100.2, changePercent: 1.2 } } } })
  expect(notify).toHaveBeenCalledTimes(1)
})

test('Should let a fired alert be dismissed from the list', () => {
  const { result, rerender } = setup({ KO: [level('a', 100)] })
  rerender({ quotes: quoteOf('KO', 99) })
  rerender({ quotes: quoteOf('KO', 101) })
  act(() => result.current.dismiss('KO:a:1'))
  expect(result.current.fired).toEqual([])
})

test('Should still list and disarm the alert when the notification fails', () => {
  const lines = { KO: [level('a', 100)] }
  const dispatch = vi.fn()
  const notify = vi.fn(() => {
    throw new Error('blocked')
  })
  const { result, rerender } = renderHook(
    (props: { quotes: Record<string, Quote> }) => useAlerts({ lines, ...props, dispatch, notify, now: () => new Date(2026, 10, 24, 15, 32) }),
    { initialProps: { quotes: {} } },
  )
  rerender({ quotes: quoteOf('KO', 99) })
  rerender({ quotes: quoteOf('KO', 101) })
  expect(result.current.fired).toHaveLength(1)
  expect(dispatch).toHaveBeenCalledWith({ type: 'setLines', symbol: 'KO', lines: [level('a', 100, false)] })
})
