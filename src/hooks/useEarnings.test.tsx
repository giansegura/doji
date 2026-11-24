import { renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { Earnings } from '../../shared/types'
import { useEarnings } from './useEarnings'

const of = (next: string): Earnings => ({ past: [], next, nextIsEstimate: false })

test('Should load the earnings of the symbol on screen', async () => {
  const { result } = renderHook(() => useEarnings('AAPL', async (symbol) => of(symbol === 'AAPL' ? '2027-01-28' : 'x')))
  await waitFor(() => expect(result.current?.next).toBe('2027-01-28'))
})

test('Should keep the earnings of the latest symbol when an older answer arrives late', async () => {
  const pending = new Map<string, (earnings: Earnings) => void>()
  const fetchEarnings = (symbol: string) => new Promise<Earnings>((resolve) => pending.set(symbol, resolve))
  const { result, rerender } = renderHook(({ symbol }) => useEarnings(symbol, fetchEarnings), { initialProps: { symbol: 'AAPL' } })
  rerender({ symbol: 'MSFT' })
  expect(result.current).toBeNull()
  pending.get('MSFT')?.(of('2027-01-27'))
  await waitFor(() => expect(result.current?.next).toBe('2027-01-27'))
  pending.get('AAPL')?.(of('2027-01-28'))
  await new Promise((done) => setTimeout(done, 0))
  expect(result.current?.next).toBe('2027-01-27')
})

test('Should show no earnings when they cannot be loaded', async () => {
  const { result } = renderHook(() => useEarnings('AAPL', async () => Promise.reject(new Error('offline'))))
  await new Promise((done) => setTimeout(done, 0))
  expect(result.current).toBeNull()
})
