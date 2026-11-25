import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { type AppState, DEFAULT_STATE } from '../../shared/types'
import type { SaveResult } from './stateSync'
import { useAppState } from './useAppState'

type Reply = 'ok' | 'conflict' | 'failed'

const makeApi = (initial: AppState = DEFAULT_STATE) => {
  const box = { server: initial, reply: 'ok' as Reply, loadFails: false }
  const puts: { state: AppState; keepalive: boolean }[] = []
  const api = {
    getState: vi.fn(async () => {
      if (box.loadFails) throw new Error('sin servidor')
      return box.server
    }),
    putState: vi.fn(async (sent: AppState, keepalive = false): Promise<SaveResult> => {
      puts.push({ state: sent, keepalive })
      if (box.reply === 'failed') return { kind: 'failed' }
      if (box.reply === 'conflict') return { kind: 'conflict' }
      box.server = { ...sent, rev: sent.rev + 1 }
      return { kind: 'saved', rev: box.server.rev }
    }),
  }
  return { api, box, puts }
}

const mount = async (setup = makeApi()) => {
  const view = renderHook(() => useAppState(setup.api))
  await act(async () => vi.advanceTimersByTimeAsync(0))
  return { ...setup, ...view }
}

const wait = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('Should load the saved state', async () => {
  const { result } = await mount()
  expect(result.current.state).toEqual(DEFAULT_STATE)
  expect(result.current.notice).toBe(null)
})

test('Should save a change 300 ms later with the revision it loaded', async () => {
  const { result, puts } = await mount()
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await wait(299)
  expect(puts).toHaveLength(0)
  await wait(1)
  expect(puts).toHaveLength(1)
  expect(puts[0].state.theme).toBe('light')
  expect(puts[0].state.rev).toBe(1)
})

test('Should use the new revision for the next save', async () => {
  const { result, puts } = await mount()
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await wait(300)
  act(() => result.current.dispatch({ type: 'setTimeframe', timeframe: 'W' }))
  await wait(300)
  expect(puts.map((put) => put.state.rev)).toEqual([1, 2])
})

test('Should not save when nothing changed', async () => {
  const { result, puts } = await mount()
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'doji' }))
  await wait(1000)
  expect(puts).toHaveLength(0)
})

test('Should reload the state and say so when another tab saved first', async () => {
  const { result, box } = await mount()
  box.reply = 'conflict'
  box.server = { ...DEFAULT_STATE, symbol: 'KO', rev: 9 }
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await wait(300)
  expect(result.current.state?.symbol).toBe('KO')
  expect(result.current.state?.theme).toBe('doji')
  expect(result.current.notice).toBe('The settings changed in another tab and were reloaded')
})

test('Should save with the reloaded revision after a conflict', async () => {
  const { result, box, puts } = await mount()
  box.reply = 'conflict'
  box.server = { ...DEFAULT_STATE, symbol: 'KO', rev: 9 }
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await wait(300)
  box.reply = 'ok'
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await wait(300)
  expect(puts.at(-1)?.state.rev).toBe(9)
  expect(puts.at(-1)?.state.symbol).toBe('KO')
})

test('Should warn when a save fails, retry, and clear the warning once saved', async () => {
  const { result, box, puts } = await mount()
  box.reply = 'failed'
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await wait(300)
  expect(result.current.notice).toBe('Could not save your changes')
  box.reply = 'ok'
  await wait(5000)
  expect(puts).toHaveLength(2)
  expect(result.current.notice).toBe(null)
})

test('Should pick up what another tab saved when this one becomes visible again', async () => {
  const { result, box } = await mount()
  box.server = { ...DEFAULT_STATE, symbol: 'MSFT', rev: 5 }
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(result.current.state?.symbol).toBe('MSFT')
  expect(result.current.notice).toBe(null)
})

test('Should not reload over a change that is still unsaved', async () => {
  const { result, api } = await mount()
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(api.getState).toHaveBeenCalledTimes(1)
  expect(result.current.state?.theme).toBe('light')
})

test('Should send an unsaved change at once when the page is being left', async () => {
  const { result, puts } = await mount()
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(puts).toHaveLength(1)
  expect(puts[0].keepalive).toBe(true)
})

test('Should say when the state could not be loaded and load it on retry', async () => {
  const setup = makeApi()
  setup.box.loadFails = true
  const { result, box } = await mount(setup)
  expect(result.current.loadFailed).toBe(true)
  expect(result.current.state).toBe(null)
  box.loadFails = false
  await act(async () => {
    result.current.retry()
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(result.current.loadFailed).toBe(false)
  expect(result.current.state).toEqual(DEFAULT_STATE)
})

test('Should pick up within five seconds what was saved from outside while the tab is visible', async () => {
  const { result, box } = await mount()
  box.server = { ...DEFAULT_STATE, symbol: 'MSFT', rev: 5 }
  await wait(4_000)
  expect(result.current.state?.symbol).toBe('AAPL')
  await wait(1_000)
  expect(result.current.state?.symbol).toBe('MSFT')
  expect(result.current.notice).toBe(null)
})

test('Should pick up at once what the server saved when asked to look again', async () => {
  const { result, box } = await mount()
  box.server = { ...DEFAULT_STATE, symbol: 'MSFT', rev: 5 }
  act(() => result.current.refresh())
  await wait(0)
  expect(result.current.state?.symbol).toBe('MSFT')
})

test('Should not ask for the state again while nothing is visible', async () => {
  const { api } = await mount()
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await wait(15_000)
  expect(api.getState).toHaveBeenCalledTimes(1)
  visibility.mockRestore()
})

test('Should count every time the state is replaced by the one on the server', async () => {
  const { result, box } = await mount()
  expect(result.current.replaced).toBe(1)
  box.server = { ...DEFAULT_STATE, symbol: 'MSFT', rev: 5 }
  await wait(5_000)
  expect(result.current.replaced).toBe(2)
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  expect(result.current.replaced).toBe(2)
})

test('Should ignore a check that answers with an older revision than the one just saved', async () => {
  const { result, api, box } = await mount()
  const before = box.server
  let answer: (state: AppState) => void = () => undefined
  api.getState.mockImplementationOnce(
    () =>
      new Promise<AppState>((resolve) => {
        answer = resolve
      }),
  )
  await wait(5_000)
  act(() => result.current.dispatch({ type: 'setTheme', theme: 'light' }))
  await wait(300)
  await act(async () => {
    answer(before)
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(result.current.state?.theme).toBe('light')
  act(() => result.current.dispatch({ type: 'setSymbol', symbol: 'MSFT' }))
  await wait(300)
  expect(box.server.symbol).toBe('MSFT')
  expect(result.current.notice).toBe(null)
})
