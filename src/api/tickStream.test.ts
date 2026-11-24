import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { LiveTick } from '../../shared/types'
import { openTickStream } from './tickStream'

const tick: LiveTick = { symbol: 'AAPL', price: 353.2, change: 4.1, changePercent: 1.18, time: 1795532303000, session: 'regular', volume: 100 }

type Source = {
  url: string
  readyState: number
  closed: boolean
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: (() => void) | null
  close: () => void
}

const sources: Source[] = []

class FakeEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  readyState = 1
  closed = false
  onmessage: Source['onmessage'] = null
  onerror: Source['onerror'] = null

  constructor(public url: string) {
    sources.push(this)
  }

  close() {
    this.closed = true
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('EventSource', FakeEventSource)
  sources.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('Should open the stream of the symbols, escaping them', () => {
  openTickStream(['AAPL', 'EURUSD=X', '^GSPC'], () => undefined)
  expect(sources.map((source) => source.url)).toEqual(['/api/stream?symbols=AAPL,EURUSD%3DX,%5EGSPC'])
})

test('Should pass on the ticks of each message', () => {
  const received: LiveTick[][] = []
  openTickStream(['AAPL'], (ticks) => received.push(ticks))
  sources[0].onmessage?.({ data: JSON.stringify([tick, { ...tick, symbol: 'KO', session: 'post', volume: null }]) })
  expect(received).toEqual([[tick, { ...tick, symbol: 'KO', session: 'post', volume: null }]])
})

test('Should skip what is not a tick and say nothing when a message has none', () => {
  const received: LiveTick[][] = []
  openTickStream(['AAPL'], (ticks) => received.push(ticks))
  const send = (data: unknown) => sources[0].onmessage?.({ data })
  send('no es json')
  send(JSON.stringify({ symbol: 'AAPL' }))
  send(JSON.stringify([null, 7, { ...tick, price: 'caro' }, { ...tick, session: 'night' }, { ...tick, time: null }]))
  send(42)
  expect(received).toEqual([])
  send(JSON.stringify([{ ...tick, price: Number.NaN }, tick]))
  expect(received).toEqual([[tick]])
})

test('Should close the stream when asked', () => {
  const close = openTickStream(['AAPL'], () => undefined)
  close()
  expect(sources[0].closed).toBe(true)
})

test('Should leave the reconnection to the browser while it keeps trying', () => {
  openTickStream(['AAPL'], () => undefined)
  sources[0].readyState = FakeEventSource.CONNECTING
  sources[0].onerror?.()
  vi.advanceTimersByTime(120_000)
  expect(sources).toHaveLength(1)
})

test('Should open the stream again half a minute after the browser gave up', () => {
  const received: LiveTick[][] = []
  openTickStream(['AAPL'], (ticks) => received.push(ticks))
  sources[0].readyState = FakeEventSource.CLOSED
  sources[0].onerror?.()
  vi.advanceTimersByTime(29_999)
  expect(sources).toHaveLength(1)
  vi.advanceTimersByTime(1)
  expect(sources).toHaveLength(2)
  sources[1].onmessage?.({ data: JSON.stringify([tick]) })
  expect(received).toEqual([[tick]])
})

test('Should not open the stream again once it was closed on purpose', () => {
  const close = openTickStream(['AAPL'], () => undefined)
  sources[0].readyState = FakeEventSource.CLOSED
  sources[0].onerror?.()
  close()
  vi.advanceTimersByTime(60_000)
  expect(sources).toHaveLength(1)
})

test('Should do nothing where the browser has no event streams', () => {
  vi.stubGlobal('EventSource', undefined)
  const close = openTickStream(['AAPL'], () => undefined)
  expect(() => close()).not.toThrow()
  expect(sources).toEqual([])
})
