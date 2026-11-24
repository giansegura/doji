import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { LiveTick } from '../shared/types'
import { createLiveHub } from './liveHub'

const tick = (symbol: string, price: number, time: number, over: Partial<LiveTick> = {}): LiveTick => ({
  symbol,
  price,
  change: 1,
  changePercent: 1,
  time,
  session: 'regular',
  volume: null,
  ...over,
})

const setup = () => {
  const watched: string[][] = []
  const hub = createLiveHub({
    now: () => 10_000,
    watch: (symbols) => watched.push(symbols),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  })
  const client = (symbols: string[]) => {
    const received: LiveTick[][] = []
    const leave = hub.join(symbols, (ticks) => received.push(ticks))
    return { received, leave }
  }
  return { hub, watched, client }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('Should watch the symbols of everyone who joined, without repeats', () => {
  const { watched, client } = setup()
  client(['MSFT', 'AAPL'])
  client(['AAPL', 'KO'])
  expect(watched).toEqual([
    ['AAPL', 'MSFT'],
    ['AAPL', 'KO', 'MSFT'],
  ])
})

test('Should not ask to watch again when a newcomer adds nothing new', () => {
  const { watched, client } = setup()
  client(['AAPL', 'MSFT'])
  client(['MSFT'])
  expect(watched).toHaveLength(1)
})

test('Should gather the ticks of a quarter of a second and send each client only its symbols', () => {
  const { hub, client } = setup()
  const first = client(['AAPL', 'MSFT'])
  const second = client(['KO'])
  hub.push(tick('AAPL', 100, 1_000))
  hub.push(tick('KO', 60, 1_000))
  vi.advanceTimersByTime(249)
  expect(first.received).toEqual([])
  hub.push(tick('MSFT', 400, 1_100))
  vi.advanceTimersByTime(1)
  expect(first.received).toEqual([[tick('AAPL', 100, 1_000), tick('MSFT', 400, 1_100)]])
  expect(second.received).toEqual([[tick('KO', 60, 1_000)]])
})

test('Should send only the latest tick of a symbol in each batch', () => {
  const { hub, client } = setup()
  const { received } = client(['AAPL'])
  hub.push(tick('AAPL', 100, 1_000))
  hub.push(tick('AAPL', 101, 2_000))
  vi.advanceTimersByTime(250)
  expect(received).toEqual([[tick('AAPL', 101, 2_000)]])
})

test('Should drop a tick older than the latest one of its symbol', () => {
  const { hub, client } = setup()
  const { received } = client(['AAPL'])
  hub.push(tick('AAPL', 101, 2_000))
  hub.push(tick('AAPL', 100, 1_000))
  vi.advanceTimersByTime(250)
  hub.push(tick('AAPL', 99, 1_500))
  vi.advanceTimersByTime(250)
  expect(received).toEqual([[tick('AAPL', 101, 2_000)]])
})

test('Should send nothing to a client when no tick is for it', () => {
  const { hub, client } = setup()
  const { received } = client(['KO'])
  hub.push(tick('AAPL', 100, 1_000))
  vi.advanceTimersByTime(250)
  expect(received).toEqual([])
})

test('Should hand a newcomer the latest ticks of its symbols at once', () => {
  const { hub, client } = setup()
  client(['AAPL', 'MSFT'])
  hub.push(tick('AAPL', 100, 1_000))
  hub.push(tick('MSFT', 400, 1_000))
  vi.advanceTimersByTime(250)
  const late = client(['AAPL', 'KO'])
  expect(late.received).toEqual([[tick('AAPL', 100, 1_000)]])
})

test('Should keep watching for ten seconds after the last client leaves, in case it comes back', () => {
  const { watched, client } = setup()
  const { leave } = client(['AAPL'])
  leave()
  vi.advanceTimersByTime(9_999)
  expect(watched).toEqual([['AAPL']])
  vi.advanceTimersByTime(1)
  expect(watched).toEqual([['AAPL'], []])
})

test('Should not stop watching when the client comes back in time with the same symbols', () => {
  const { hub, watched, client } = setup()
  const first = client(['AAPL'])
  hub.push(tick('AAPL', 100, 1_000))
  first.leave()
  vi.advanceTimersByTime(3_000)
  const back = client(['AAPL'])
  vi.advanceTimersByTime(60_000)
  expect(watched).toEqual([['AAPL']])
  expect(back.received).toEqual([[tick('AAPL', 100, 1_000)]])
})

test('Should forget the ticks of symbols nobody watches any more', () => {
  const { hub, client } = setup()
  const first = client(['AAPL'])
  hub.push(tick('AAPL', 100, 1_000))
  first.leave()
  vi.advanceTimersByTime(10_000)
  const later = client(['AAPL'])
  expect(later.received).toEqual([])
})

test('Should not send to a client that left', () => {
  const { hub, client } = setup()
  const { received, leave } = client(['AAPL'])
  hub.push(tick('AAPL', 100, 1_000))
  leave()
  vi.advanceTimersByTime(250)
  expect(received).toEqual([])
})

test('Should count the clients that are connected', () => {
  const { hub, client } = setup()
  expect(hub.size()).toBe(0)
  const first = client(['AAPL'])
  client(['KO'])
  expect(hub.size()).toBe(2)
  first.leave()
  first.leave()
  expect(hub.size()).toBe(1)
})

test('Should keep serving the others when sending to one client fails', () => {
  const { hub, client } = setup()
  hub.join(['AAPL'], () => {
    throw new Error('closed')
  })
  const { received } = client(['AAPL'])
  hub.push(tick('AAPL', 100, 1_000))
  vi.advanceTimersByTime(250)
  expect(received).toHaveLength(1)
})

test('Should drop a tick dated more than an hour ahead of the clock', () => {
  const { hub, client } = setup()
  const { received } = client(['AAPL'])
  hub.push(tick('AAPL', 100, 10_000 + 3_600_001))
  hub.push(tick('AAPL', 101, 10_000 + 3_600_000))
  vi.advanceTimersByTime(250)
  expect(received).toEqual([[tick('AAPL', 101, 10_000 + 3_600_000)]])
})
