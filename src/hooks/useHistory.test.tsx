import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { History } from '../../shared/types'
import { type HistoryStore, createHistoryStore } from './historyStore'
import { useHistory } from './useHistory'

let store: HistoryStore = createHistoryStore()

beforeEach(() => {
  store = createHistoryStore()
})

const historyOf = (symbol: string, close = 1): History => ({
  info: { symbol, name: symbol, exchange: 'NYSE' },
  bars: [{ time: '2026-11-23', open: 1, high: 1, low: 1, close, volume: 1 }],
  splits: [],
  fetchedAt: 'x',
  stale: false,
})

const failWith = (code: string) => Promise.reject(Object.assign(new Error(code), { code }))

afterEach(() => {
  vi.useRealTimers()
})

test('Should load the history of the symbol', async () => {
  const fetcher = vi.fn(async (symbol: string) => historyOf(symbol))
  const { result } = renderHook(() => useHistory('AAPL', fetcher, store))
  expect(result.current.status).toBe('loading')
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current.history?.info.symbol).toBe('AAPL')
})

test('Should never show the previous symbol while the next one loads', async () => {
  const fetcher = vi.fn(async (symbol: string) => historyOf(symbol))
  const { result, rerender } = renderHook(({ symbol }) => useHistory(symbol, fetcher, store), { initialProps: { symbol: 'AAPL' } })
  await waitFor(() => expect(result.current.status).toBe('ready'))
  rerender({ symbol: 'MSFT' })
  expect(result.current.status).toBe('loading')
  expect(result.current.history).toBe(null)
  await waitFor(() => expect(result.current.history?.info.symbol).toBe('MSFT'))
})

test('Should ignore a slow answer for a symbol that is no longer shown', async () => {
  let releaseSlow: (history: History) => void = () => undefined
  const slow = new Promise<History>((resolve) => {
    releaseSlow = resolve
  })
  const fetcher = vi.fn((symbol: string) => (symbol === 'AAPL' ? slow : Promise.resolve(historyOf(symbol))))
  const { result, rerender } = renderHook(({ symbol }) => useHistory(symbol, fetcher, store), { initialProps: { symbol: 'AAPL' } })
  rerender({ symbol: 'MSFT' })
  await waitFor(() => expect(result.current.history?.info.symbol).toBe('MSFT'))
  await act(async () => releaseSlow(historyOf('AAPL')))
  expect(result.current.history?.info.symbol).toBe('MSFT')
})

test('Should report the error code when the first load fails', async () => {
  const { result } = renderHook(() => useHistory('NOEXISTE', () => failWith('not_found'), store))
  await waitFor(() => expect(result.current.status).toBe('error'))
  expect(result.current.errorCode).toBe('not_found')
  expect(result.current.history).toBe(null)
})

test('Should stop asking for a symbol that does not exist', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn(() => failWith('not_found'))
  const { result } = renderHook(() => useHistory('NOEXISTE', fetcher, store))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  await act(async () => vi.advanceTimersByTimeAsync(60_000))
  expect(result.current.errorCode).toBe('not_found')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('Should keep trying while the data is merely unavailable', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn(() => failWith('unavailable'))
  renderHook(() => useHistory('AAPL', fetcher, store))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(fetcher).toHaveBeenCalledTimes(3)
})

test('Should load again on retry', async () => {
  const fetcher = vi
    .fn<(symbol: string) => Promise<History>>()
    .mockImplementationOnce(() => failWith('unavailable'))
    .mockImplementation(async (symbol) => historyOf(symbol))
  const { result } = renderHook(() => useHistory('AAPL', fetcher, store))
  await waitFor(() => expect(result.current.status).toBe('error'))
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.status).toBe('ready'))
})

test('Should refresh every fifteen seconds while the tab is visible', async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn<(symbol: string) => Promise<History>>()
    .mockImplementationOnce(async (symbol) => historyOf(symbol, 1))
    .mockImplementation(async (symbol) => historyOf(symbol, 2))
  const { result } = renderHook(() => useHistory('AAPL', fetcher, store))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  expect(result.current.history?.bars[0].close).toBe(1)
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(result.current.history?.bars[0].close).toBe(2)
})

test('Should keep what is on screen when a refresh fails', async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn<(symbol: string) => Promise<History>>()
    .mockImplementationOnce(async (symbol) => historyOf(symbol))
    .mockImplementation(() => failWith('unavailable'))
  const { result } = renderHook(() => useHistory('AAPL', fetcher, store))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(result.current.status).toBe('ready')
  expect(result.current.history?.info.symbol).toBe('AAPL')
})

test('Should not refresh while the tab is hidden', async () => {
  vi.useFakeTimers()
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  const fetcher = vi.fn(async (symbol: string) => historyOf(symbol))
  renderHook(() => useHistory('AAPL', fetcher, store))
  await act(async () => vi.advanceTimersByTimeAsync(180_000))
  expect(fetcher).toHaveBeenCalledTimes(1)
  visibility.mockRestore()
})

test('Should keep every history it loads', async () => {
  const fetcher = vi.fn(async (symbol: string) => historyOf(symbol, 7))
  const { result } = renderHook(() => useHistory('AAPL', fetcher, store))
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(store.get('AAPL')?.bars[0].close).toBe(7)
})

test('Should show at once a history it already keeps', () => {
  const kept = historyOf('MSFT', 3)
  store.keep('MSFT', kept)
  const fetcher = vi.fn(() => new Promise<History>(() => undefined))
  const { result } = renderHook(() => useHistory('MSFT', fetcher, store))
  expect(result.current.status).toBe('ready')
  expect(result.current.history).toBe(kept)
})

test('Should switch at once to a symbol whose history it keeps', async () => {
  const kept = historyOf('MSFT', 3)
  store.keep('MSFT', kept)
  const pending = new Promise<History>(() => undefined)
  const fetcher = vi.fn((symbol: string) => (symbol === 'MSFT' ? pending : Promise.resolve(historyOf(symbol))))
  const { result, rerender } = renderHook(({ symbol }) => useHistory(symbol, fetcher, store), {
    initialProps: { symbol: 'AAPL' },
  })
  await waitFor(() => expect(result.current.status).toBe('ready'))
  rerender({ symbol: 'MSFT' })
  expect(result.current.status).toBe('ready')
  expect(result.current.history).toBe(kept)
})

test('Should still ask for fresh data after showing a kept history, and show it when it arrives', async () => {
  store.keep('MSFT', historyOf('MSFT', 3))
  const fetcher = vi.fn(async (symbol: string) => historyOf(symbol, 9))
  const { result } = renderHook(() => useHistory('MSFT', fetcher, store))
  expect(result.current.history?.bars[0].close).toBe(3)
  await waitFor(() => expect(result.current.history?.bars[0].close).toBe(9))
  expect(fetcher).toHaveBeenCalledWith('MSFT')
  expect(store.get('MSFT')?.bars[0].close).toBe(9)
})

test('Should keep showing a kept history when the fresh data cannot be loaded', async () => {
  const kept = historyOf('MSFT', 3)
  store.keep('MSFT', kept)
  const fetcher = vi.fn(() => failWith('unavailable'))
  const { result } = renderHook(() => useHistory('MSFT', fetcher, store))
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  await act(async () => undefined)
  expect(result.current.status).toBe('ready')
  expect(result.current.history).toBe(kept)
})
