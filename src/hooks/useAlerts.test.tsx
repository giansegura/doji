import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { AlertEvent } from '../../shared/types'
import { useAlerts } from './useAlerts'

const alert = (over: Partial<AlertEvent> = {}): AlertEvent => ({
  id: 'a1',
  symbol: 'AAPL',
  level: 190.5,
  price: 190.62,
  direction: 'up',
  at: new Date(2026, 10, 24, 15, 32).toISOString(),
  text: null,
  ...over,
})

const setup = (notify = vi.fn(), onFired = vi.fn()) => {
  const listeners: ((alerts: AlertEvent[]) => void)[] = []
  let closed = 0
  const openAlerts = (onAlerts: (alerts: AlertEvent[]) => void) => {
    listeners.push(onAlerts)
    return () => {
      closed += 1
    }
  }
  const hook = renderHook(() => useAlerts({ notify, openAlerts, onFired }))
  const fire = (alerts: AlertEvent[]) => act(() => listeners.forEach((listener) => listener(alerts)))
  return { notify, onFired, fire, closed: () => closed, ...hook }
}

test('Should stay quiet until the server says an alert fired', () => {
  const { notify, result } = setup()
  expect(result.current.fired).toEqual([])
  expect(notify).not.toHaveBeenCalled()
})

test('Should notify and list an alert the server fired, with the text of its line', () => {
  const { notify, fire, result } = setup()
  fire([alert({ text: 'R1' })])
  expect(notify).toHaveBeenCalledWith('AAPL crossed 190.50', 'Up through 190.50, now at 190.62 · R1')
  expect(result.current.fired).toEqual([{ id: 'a1', text: 'AAPL crossed 190.50 going up', time: '15:32' }])
})

test('Should say when the price crossed going down', () => {
  const { notify, fire, result } = setup()
  fire([alert({ direction: 'down', price: 190.3 })])
  expect(notify).toHaveBeenCalledWith('AAPL crossed 190.50', 'Down through 190.50, now at 190.30')
  expect(result.current.fired[0].text).toBe('AAPL crossed 190.50 going down')
})

test('Should let a fired alert be dismissed from the list and list it once even if told twice', () => {
  const { fire, result } = setup()
  fire([alert()])
  fire([alert()])
  expect(result.current.fired).toHaveLength(1)
  act(() => result.current.dismiss('a1'))
  expect(result.current.fired).toEqual([])
})

test('Should still list the alert when the notification fails', () => {
  const { fire, result } = setup(
    vi.fn(() => {
      throw new Error('denied')
    }),
  )
  fire([alert()])
  expect(result.current.fired).toHaveLength(1)
})

test('Should stop listening when the page closes', () => {
  const { unmount, closed } = setup()
  unmount()
  expect(closed()).toBe(1)
})

test('Should name what an indicator alert watched', () => {
  const { notify, fire, result } = setup()
  fire([alert({ level: 30, price: 58.1, direction: 'down', label: 'RSI 14 crosses 30' })])
  expect(notify).toHaveBeenCalledWith('AAPL: RSI 14 crosses 30', 'Going down, now at 58.10')
  expect(result.current.fired[0].text).toBe('AAPL: RSI 14 crosses 30, going down')
})

test('Should say that alerts fired, so the saved state can be read again, but not for alerts already seen', () => {
  const { onFired, fire } = setup()
  fire([alert()])
  expect(onFired).toHaveBeenCalledTimes(1)
  fire([alert()])
  expect(onFired).toHaveBeenCalledTimes(1)
})
