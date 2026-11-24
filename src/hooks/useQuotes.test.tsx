import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { LiveTick, Quote } from '../../shared/types'
import type { OpenTickStream } from '../api/tickStream'
import { useQuotes } from './useQuotes'

const quote = (symbol: string, price: number): Quote => ({ symbol, price, change: 1, changePercent: 1 })

afterEach(() => {
  vi.useRealTimers()
})

test('Should load quotes keyed by symbol', async () => {
  const fetcher = vi.fn(async (symbols: string[]) => symbols.map((symbol) => quote(symbol, 10)))
  const { result } = renderHook(() => useQuotes(['AAPL', 'MSFT'], fetcher))
  expect(result.current.quotes).toEqual({})
  await waitFor(() => expect(Object.keys(result.current.quotes)).toEqual(['AAPL', 'MSFT']))
  expect(result.current.quotes.AAPL.price).toBe(10)
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
  await waitFor(() => expect(result.current.quotes.AAPL).toBeTruthy())
  rerender({ symbols: ['AAPL'] })
  rerender({ symbols: ['AAPL', 'KO'] })
  await waitFor(() => expect(result.current.quotes.KO).toBeTruthy())
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher).toHaveBeenLastCalledWith(['AAPL', 'KO'])
})

test('Should not ask again when the same symbols come in another order', async () => {
  const fetcher = vi.fn(async (symbols: string[]) => symbols.map((symbol) => quote(symbol, 10)))
  const { result, rerender } = renderHook(({ symbols }) => useQuotes(symbols, fetcher), {
    initialProps: { symbols: ['MSFT', 'AAPL', 'KO'] },
  })
  await waitFor(() => expect(result.current.quotes.KO).toBeTruthy())
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
  expect(result.current.quotes.AAPL.price).toBe(10)
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(result.current.quotes.AAPL.price).toBe(11)
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
  expect(result.current.quotes.AAPL.price).toBe(10)
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
  expect(result.current.quotes.AAPL.price).toBe(11)
  expect(result.current.quotes.KO.price).toBe(60)
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

test('Should keep refreshing while the tab is hidden when asked to work in the background', async () => {
  vi.useFakeTimers()
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  const fetcher = vi.fn(async (symbols: string[]) => symbols.map((symbol) => ({ symbol, price: 1, change: 0, changePercent: 0 })))
  renderHook(() => useQuotes(['AAPL'], fetcher, true))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000)
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
  visibility.mockRestore()
  vi.useRealTimers()
})

test('Should not let a slow answer replace the quotes of a later one', async () => {
  vi.useFakeTimers()
  const pending: ((quotes: Quote[]) => void)[] = []
  const fetcher = vi.fn(() => new Promise<Quote[]>((resolve) => pending.push(resolve)))
  const { result } = renderHook(() => useQuotes(['AAPL'], fetcher))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000)
  })
  expect(pending).toHaveLength(2)
  await act(async () => {
    pending[1]([quote('AAPL', 20)])
  })
  await act(async () => {
    pending[0]([quote('AAPL', 10)])
  })
  expect(result.current.quotes.AAPL?.price).toBe(20)
})

const timed = (symbol: string, price: number, time: number): Quote => ({ ...quote(symbol, price), time })

const liveTick = (symbol: string, price: number, time: number): LiveTick => ({
  symbol,
  price,
  change: 0,
  changePercent: 0,
  time,
  session: 'regular',
  volume: null,
})

const fakeStream = () => {
  const opened: { symbols: string[]; onTicks: (ticks: LiveTick[]) => void; closed: boolean }[] = []
  const open: OpenTickStream = (symbols, onTicks) => {
    const entry = { symbols, onTicks, closed: false }
    opened.push(entry)
    return () => {
      entry.closed = true
    }
  }
  return { open, opened }
}

const allAt = (time: number) => async (symbols: string[]) => symbols.map((symbol) => timed(symbol, 10, time))

const showTab = (state: 'visible' | 'hidden') => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  const change = (next: 'visible' | 'hidden') => {
    visibility.mockReturnValue(next)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }
  return { change, restore: () => visibility.mockRestore() }
}

test('Should open the price stream of the symbols and move the quotes with its ticks', async () => {
  vi.useFakeTimers()
  const { open, opened } = fakeStream()
  const { result } = renderHook(() => useQuotes(['MSFT', 'AAPL'], allAt(1_000), false, open))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  expect(opened.map((entry) => entry.symbols)).toEqual([['AAPL', 'MSFT']])
  act(() => opened[0].onTicks([liveTick('AAPL', 12, 2_000)]))
  expect(result.current.quotes.AAPL.price).toBe(12)
  expect(result.current.quotes.MSFT.price).toBe(10)
})

test('Should say prices are live after a tick and stop saying it once the ticks stop', async () => {
  vi.useFakeTimers()
  const { open, opened } = fakeStream()
  const { result } = renderHook(() => useQuotes(['AAPL'], allAt(1_000), false, open))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  expect(result.current.live).toBe(false)
  act(() => opened[0].onTicks([liveTick('AAPL', 12, 2_000)]))
  expect(result.current.live).toBe(true)
  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(result.current.live).toBe(true)
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(result.current.live).toBe(false)
})

test('Should ask only for the symbols without recent ticks, and for all of them once a minute', async () => {
  vi.useFakeTimers()
  const { open, opened } = fakeStream()
  const fetcher = vi.fn(allAt(1_000))
  renderHook(() => useQuotes(['AAPL', 'KO'], fetcher, false, open))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  for (const round of [1, 2, 3, 4]) {
    act(() => opened[0].onTicks([liveTick('AAPL', 12, 2_000 + round)]))
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
  }
  expect(fetcher.mock.calls.map(([symbols]) => symbols)).toEqual([['AAPL', 'KO'], ['KO'], ['KO'], ['KO'], ['AAPL', 'KO']])
})

test('Should not ask at all while every symbol is ticking, except once a minute', async () => {
  vi.useFakeTimers()
  const { open, opened } = fakeStream()
  const fetcher = vi.fn(allAt(1_000))
  renderHook(() => useQuotes(['AAPL'], fetcher, false, open))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  for (const round of [1, 2, 3]) {
    act(() => opened[0].onTicks([liveTick('AAPL', 12, 2_000 + round)]))
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
  }
  expect(fetcher).toHaveBeenCalledTimes(1)
  act(() => opened[0].onTicks([liveTick('AAPL', 12, 2_010)]))
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(fetcher).toHaveBeenCalledTimes(2)
})

test('Should not let an older answer move a ticked price back', async () => {
  vi.useFakeTimers()
  const { open, opened } = fakeStream()
  const fetcher = vi
    .fn<(symbols: string[]) => Promise<Quote[]>>()
    .mockImplementationOnce(async () => [timed('AAPL', 10, 1_000)])
    .mockImplementation(async () => [timed('AAPL', 11, 3_000)])
  const { result } = renderHook(() => useQuotes(['AAPL'], fetcher, false, open))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  act(() => opened[0].onTicks([liveTick('AAPL', 12, 5_000)]))
  await act(async () => vi.advanceTimersByTimeAsync(45_000))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(result.current.quotes.AAPL.price).toBe(12)
})

test('Should close the stream while the tab is hidden and open it again when it shows', async () => {
  const tab = showTab('visible')
  const { open, opened } = fakeStream()
  renderHook(() => useQuotes(['AAPL'], allAt(1_000), false, open))
  expect(opened).toHaveLength(1)
  tab.change('hidden')
  expect(opened[0].closed).toBe(true)
  tab.change('visible')
  expect(opened.map((entry) => entry.closed)).toEqual([true, false])
  tab.restore()
})

test('Should not open the stream in a tab that starts hidden', async () => {
  const tab = showTab('hidden')
  const { open, opened } = fakeStream()
  renderHook(() => useQuotes(['AAPL'], allAt(1_000), false, open))
  expect(opened).toEqual([])
  tab.restore()
})

test('Should keep the stream open in a hidden tab when asked to work in the background', async () => {
  const tab = showTab('hidden')
  const { open, opened } = fakeStream()
  renderHook(() => useQuotes(['AAPL'], allAt(1_000), true, open))
  tab.change('hidden')
  expect(opened.map((entry) => entry.closed)).toEqual([false])
  tab.restore()
})

test('Should open a new stream when the list changes and close the old one', async () => {
  const { open, opened } = fakeStream()
  const { rerender } = renderHook(({ symbols }) => useQuotes(symbols, allAt(1_000), false, open), {
    initialProps: { symbols: ['AAPL'] },
  })
  rerender({ symbols: ['KO', 'AAPL'] })
  expect(opened.map((entry) => [entry.symbols, entry.closed])).toEqual([
    [['AAPL'], true],
    [['AAPL', 'KO'], false],
  ])
})

test('Should close the stream when it is no longer used, and open none for an empty list', async () => {
  const { open, opened } = fakeStream()
  const { unmount } = renderHook(() => useQuotes(['AAPL'], allAt(1_000), false, open))
  unmount()
  expect(opened[0].closed).toBe(true)
  renderHook(() => useQuotes([], allAt(1_000), false, open))
  expect(opened).toHaveLength(1)
})

test('Should take the symbols of a slow full answer that a later partial answer did not bring', async () => {
  vi.useFakeTimers()
  const { open, opened } = fakeStream()
  const answers: ((quotes: Quote[]) => void)[] = []
  const fetcher = vi
    .fn<(symbols: string[]) => Promise<Quote[]>>()
    .mockImplementationOnce(async () => [quote('AAPL', 10), quote('KO', 60)])
    .mockImplementation(() => new Promise<Quote[]>((resolve) => answers.push(resolve)))
  const { result } = renderHook(() => useQuotes(['AAPL', 'KO'], fetcher, false, open))
  await act(async () => vi.advanceTimersByTimeAsync(10))
  for (const round of [1, 2, 3]) {
    act(() => opened[0].onTicks([liveTick('AAPL', 12, 2_000 + round)]))
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
  }
  act(() => opened[0].onTicks([liveTick('AAPL', 12, 2_010)]))
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(fetcher.mock.calls.slice(-1)[0][0]).toEqual(['AAPL', 'KO'])
  await act(async () => vi.advanceTimersByTimeAsync(15_000))
  expect(fetcher.mock.calls.slice(-1)[0][0]).toEqual(['KO'])
  const [full, partial] = answers.slice(-2)
  await act(async () => partial([quote('KO', 62)]))
  await act(async () => full([quote('AAPL', 11), quote('KO', 61)]))
  expect(result.current.quotes.KO.price).toBe(62)
  expect(result.current.quotes.AAPL.price).toBe(11)
})
