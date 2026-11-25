import { renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { History } from '../../shared/types'
import { useFxBars } from './useFxBars'

const ratesAt = (close: number) =>
  ({ bars: [{ time: '2026-11-24', open: close, high: close, low: close, close, volume: 0 }] }) as History

const rates = ratesAt(1.09)

test('Should load the euro rates only when a pair is needed', async () => {
  const asked: string[] = []
  const fetchHistory = async (symbol: string) => {
    asked.push(symbol)
    return rates
  }
  const { result, rerender } = renderHook(({ pair }) => useFxBars(pair, fetchHistory), { initialProps: { pair: null as string | null } })
  expect(result.current.bars).toBeNull()
  rerender({ pair: 'EURUSD=X' })
  await waitFor(() => expect(result.current.bars).toEqual(rates.bars))
  expect(asked).toEqual(['EURUSD=X'])
  rerender({ pair: null })
  expect(result.current.bars).toBeNull()
})

test('Should ask for the rates again now and then, so a chart left open in euros uses the current rate', async () => {
  let close = 1.25
  const fetchHistory = async () => ratesAt(close)
  const { result } = renderHook(() => useFxBars('EURUSD=X', fetchHistory, 20))
  await waitFor(() => expect(result.current.bars?.at(-1)?.close).toBe(1.25))
  close = 1.26
  await waitFor(() => expect(result.current.bars?.at(-1)?.close).toBe(1.26))
})

test('Should say when the rates could not be loaded and keep trying', async () => {
  let fail = true
  const fetchHistory = async () => {
    if (fail) throw new Error('unavailable')
    return rates
  }
  const { result } = renderHook(() => useFxBars('EURUSD=X', fetchHistory, 20))
  await waitFor(() => expect(result.current.failed).toBe(true))
  expect(result.current.bars).toBeNull()
  fail = false
  await waitFor(() => expect(result.current.bars).toEqual(rates.bars))
  expect(result.current.failed).toBe(false)
})
