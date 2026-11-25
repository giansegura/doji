import { renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { History } from '../../shared/types'
import { useFxBars } from './useFxBars'

const rates = { bars: [{ time: '2026-11-24', open: 1.09, high: 1.1, low: 1.08, close: 1.09, volume: 0 }] } as History

test('Should load the euro rates only when a pair is needed', async () => {
  const asked: string[] = []
  const fetchHistory = async (symbol: string) => {
    asked.push(symbol)
    return rates
  }
  const { result, rerender } = renderHook(({ pair }) => useFxBars(pair, fetchHistory), { initialProps: { pair: null as string | null } })
  expect(result.current).toBeNull()
  rerender({ pair: 'EURUSD=X' })
  await waitFor(() => expect(result.current).toEqual(rates.bars))
  expect(asked).toEqual(['EURUSD=X'])
  rerender({ pair: null })
  expect(result.current).toBeNull()
})
