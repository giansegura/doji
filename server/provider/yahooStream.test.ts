import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { LiveTick } from '../../shared/types'
import { type SocketLike, YAHOO_STREAM_URL, createYahooStream } from './yahooStream'

const AAPL = 'CgRBQVBMFYWbsEMYsKqF4cFoKgNOTVMwCDgBRYGdlz9IiIfKBWUAUoRAsAFQ2AEE9QIAUoRA/QKBnZc/'
const EURUSD = 'CghFVVJVU0Q9WBVHd4w/GLCqheHBaCoDQ0NZMA44AUVJQSo/ZQCS7TvYAQj1AgCS7Tv9AklBKj8='

type Listener = (event: { data?: unknown }) => void

const fakeSocket = () => {
  const listeners = new Map<string, Listener[]>()
  const sent: unknown[] = []
  const box = { closed: false, failSend: false }
  const socket: SocketLike = {
    send: (data) => {
      if (box.failSend) throw new Error('not open')
      sent.push(JSON.parse(data))
    },
    close: () => {
      box.closed = true
    },
    addEventListener: (type, listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
  }
  const emit = (type: string, data?: unknown) => (listeners.get(type) ?? []).forEach((listener) => listener({ data }))
  return { socket, sent, box, emit, pricing: (message: string) => emit('message', JSON.stringify({ type: 'pricing', message })) }
}

const setup = () => {
  const sockets: ReturnType<typeof fakeSocket>[] = []
  const urls: string[] = []
  const ticks: LiveTick[] = []
  const stream = createYahooStream({
    connect: (url) => {
      urls.push(url)
      const created = fakeSocket()
      sockets.push(created)
      return created.socket
    },
    onTick: (tick) => ticks.push(tick),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  })
  return { stream, sockets, urls, ticks }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('Should not connect while nobody wants prices', () => {
  const { stream, sockets } = setup()
  stream.setSymbols([])
  expect(sockets).toHaveLength(0)
})

test('Should connect to Yahoo and subscribe to the symbols once the connection opens', () => {
  const { stream, sockets, urls } = setup()
  stream.setSymbols(['AAPL', 'EURUSD=X'])
  expect(urls).toEqual([YAHOO_STREAM_URL])
  expect(sockets[0].sent).toEqual([])
  sockets[0].emit('open')
  expect(sockets[0].sent).toEqual([{ subscribe: ['AAPL', 'EURUSD=X'] }])
})

test('Should pass on the ticks of the symbols it follows', () => {
  const { stream, sockets, ticks } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('open')
  sockets[0].pricing(AAPL)
  sockets[0].pricing(EURUSD)
  expect(ticks.map((tick) => [tick.symbol, tick.price])).toEqual([['AAPL', 353.215]])
})

test('Should ignore messages it cannot read', () => {
  const { stream, sockets, ticks } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('open')
  sockets[0].emit('message', 'no es json')
  sockets[0].emit('message', JSON.stringify({ type: 'pricing' }))
  sockets[0].emit('message', JSON.stringify({ message: 42 }))
  sockets[0].emit('message', new Uint8Array([1, 2, 3]))
  sockets[0].emit('message', JSON.stringify({ message: 'x'.repeat(20_000) }))
  sockets[0].pricing(AAPL)
  expect(ticks).toHaveLength(1)
})

test('Should subscribe again every fifteen seconds so Yahoo keeps sending', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('open')
  vi.advanceTimersByTime(14_999)
  expect(sockets[0].sent).toHaveLength(1)
  vi.advanceTimersByTime(1)
  vi.advanceTimersByTime(15_000)
  expect(sockets[0].sent).toEqual([{ subscribe: ['AAPL'] }, { subscribe: ['AAPL'] }, { subscribe: ['AAPL'] }])
})

test('Should subscribe to new symbols and unsubscribe from the ones nobody wants any more', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL', 'KO'])
  sockets[0].emit('open')
  stream.setSymbols(['AAPL', 'MSFT'])
  expect(sockets[0].sent.slice(1)).toEqual([{ unsubscribe: ['KO'] }, { subscribe: ['AAPL', 'MSFT'] }])
})

test('Should send nothing when the symbols did not change', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL', 'KO'])
  sockets[0].emit('open')
  stream.setSymbols(['KO', 'AAPL', 'aapl'])
  expect(sockets[0].sent).toHaveLength(1)
})

test('Should subscribe to the latest symbols when they change before the connection opens', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  stream.setSymbols(['MSFT'])
  expect(sockets).toHaveLength(1)
  sockets[0].emit('open')
  expect(sockets[0].sent).toEqual([{ subscribe: ['MSFT'] }])
})

test('Should close the connection when nobody wants prices any more', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('open')
  stream.setSymbols([])
  expect(sockets[0].box.closed).toBe(true)
  sockets[0].emit('close')
  vi.advanceTimersByTime(120_000)
  expect(sockets).toHaveLength(1)
  expect(sockets[0].sent).toHaveLength(1)
})

test('Should connect again after a second when the connection drops, and subscribe again', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('open')
  sockets[0].emit('close')
  vi.advanceTimersByTime(999)
  expect(sockets).toHaveLength(1)
  vi.advanceTimersByTime(1)
  expect(sockets).toHaveLength(2)
  sockets[1].emit('open')
  expect(sockets[1].sent).toEqual([{ subscribe: ['AAPL'] }])
})

test('Should count an error and the close that follows it as one drop', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('error')
  sockets[0].emit('close')
  expect(sockets[0].box.closed).toBe(true)
  vi.advanceTimersByTime(1_000)
  expect(sockets).toHaveLength(2)
})

test('Should wait longer after each failed attempt, up to a minute', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  const waits = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]
  waits.forEach((wait, index) => {
    sockets[index].emit('close')
    vi.advanceTimersByTime(wait - 1)
    expect(sockets).toHaveLength(index + 1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(index + 2)
  })
})

test('Should start from a short wait again once ticks have arrived', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('close')
  vi.advanceTimersByTime(1_000)
  sockets[1].emit('close')
  vi.advanceTimersByTime(2_000)
  sockets[2].emit('open')
  sockets[2].pricing(AAPL)
  sockets[2].emit('close')
  vi.advanceTimersByTime(1_000)
  expect(sockets).toHaveLength(4)
})

test('Should not let an old connection speak after it was replaced', () => {
  const { stream, sockets, ticks } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('open')
  sockets[0].emit('close')
  vi.advanceTimersByTime(1_000)
  sockets[0].pricing(AAPL)
  sockets[0].emit('close')
  vi.advanceTimersByTime(60_000)
  expect(ticks).toEqual([])
  expect(sockets).toHaveLength(2)
})

test('Should stop the heartbeat of a connection that dropped', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('open')
  sockets[0].emit('close')
  vi.advanceTimersByTime(30_000)
  expect(sockets[0].sent).toHaveLength(1)
})

test('Should treat a failed send as a drop and connect again', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(['AAPL'])
  sockets[0].emit('open')
  sockets[0].box.failSend = true
  vi.advanceTimersByTime(15_000)
  expect(sockets[0].box.closed).toBe(true)
  vi.advanceTimersByTime(1_000)
  expect(sockets).toHaveLength(2)
})

test('Should try again later when the connection cannot even be started', () => {
  const ticks: LiveTick[] = []
  let attempts = 0
  const stream = createYahooStream({
    connect: () => {
      attempts += 1
      throw new Error('no network')
    },
    onTick: (tick) => ticks.push(tick),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  })
  stream.setSymbols(['AAPL'])
  expect(attempts).toBe(1)
  vi.advanceTimersByTime(1_000)
  expect(attempts).toBe(2)
})

test('Should follow at most three hundred symbols', () => {
  const { stream, sockets } = setup()
  stream.setSymbols(Array.from({ length: 320 }, (_, index) => `S${index}`))
  sockets[0].emit('open')
  expect((sockets[0].sent[0] as { subscribe: string[] }).subscribe).toHaveLength(300)
})
