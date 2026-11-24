import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { Quote } from '../../shared/types'
import { useQuotes } from './useQuotes'

const quote = (symbol: string, price: number): Quote => ({ symbol, price, change: 1, changePercent: 1 })

afterEach(() => {
  vi.useRealTimers()
})

test('Should load quotes keyed by symbol', async () => {
  const fetcher = vi.fn(async (symbols: string[]) => symbols.map((symbol) => quote(symbol, 10)))
  const { result } = renderHook(() => useQuotes(['AAPL', 'MSFT'], fetcher))
  expect(result.current).toEqual({})
  await waitFor(() => expect(Object.keys(result.current)).toEqual(['AAPL', 'MSFT']))
  expect(result.current.AAPL.price).toBe(10)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('Should not ask for quotes of an empty list', async () => {
  const fetcher = vi.fn(async () => [])
  renderHook(() => useQuotes([], fetcher))
  await act(async () => new Promise((done) => setTimeout(done, 20)))
  expect(fetcher).not.toHaveBeenCalled()
})

test('Should ask again when the list changes but not when it is the same list', async () => {
  const fetcher = vi.fn(async (symbols: string[]) => symbols.map((symbol) => quote(symbol, 10)))
  const { result, rerender } = renderHook(({ symbols }) => useQuotes(symbols, fetcher), {
    initialProps: { symbols: ['AAPL'] },
  })
  await waitFor(() => expect(result.current.AAPL).toBeTruthy())
  rerender({ symbols: ['AAPL'] })
  rerender({ symbols: ['AAPL', 'KO'] })
  await waitFor(() => expect(result.current.KO).toBeTruthy())
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher).toHaveBeenLastCalledWith(['AAPL', 'KO'])
})

test('Should not ask again when the same symbols come in another order', async () => {
  const fetcher = vi.fn(async (symbols: string[]) => symbols.map((symbol) => quote(symbol, 10)))
  const { result, rerender } = renderHook(({ symbols }) => useQuotes(symbols, fetcher), {
    initialProps: { symbols: ['MSFT', 'AAPL', 'KO'] },
  })
  await waitFor(() => expect(result.current.KO).toBeTruthy())
  rerender({ symbols: ['KO', 'MSFT', 'AAPL'] })
  await act(async () => new Promise((done) => setTimeout(done, 20)))
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('Should refresh every fifteen seconds while the tab is visible', async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn<(symbols: string[]) => Promise<Quote[]>>()
    .mockImplementationOnce(async () => [quote('AAPL', 10)])
    .mockImplementation(async () => [quote('AAPL', 11)])
  const { result } = renderHook(() => useQuotes(['AAPL'], fetcher))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  expect(result.current.AAPL.price).toBe(10)
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(result.current.AAPL.price).toBe(11)
})

test('Should keep the previous quotes when a refresh fails', async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn<(symbols: string[]) => Promise<Quote[]>>()
    .mockImplementationOnce(async () => [quote('AAPL', 10)])
    .mockImplementation(() => Promise.reject(new Error('sin red')))
  const { result } = renderHook(() => useQuotes(['AAPL'], fetcher))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(result.current.AAPL.price).toBe(10)
})

test('Should keep a quote that a later answer leaves out', async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn<(symbols: string[]) => Promise<Quote[]>>()
    .mockImplementationOnce(async () => [quote('AAPL', 10), quote('KO', 60)])
    .mockImplementation(async () => [quote('AAPL', 11)])
  const { result } = renderHook(() => useQuotes(['AAPL', 'KO'], fetcher))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(result.current.AAPL.price).toBe(11)
  expect(result.current.KO.price).toBe(60)
})

test('Should not refresh while the tab is hidden', async () => {
  vi.useFakeTimers()
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  const fetcher = vi.fn(async () => [quote('AAPL', 10)])
  renderHook(() => useQuotes(['AAPL'], fetcher))
  await act(async () => vi.advanceTimersByTimeAsync(180_000))
  expect(fetcher).toHaveBeenCalledTimes(1)
  visibility.mockRestore()
})
