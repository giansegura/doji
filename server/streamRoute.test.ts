import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, expect, test } from 'vitest'
import type { LiveTick } from '../shared/types'
import type { LiveHub } from './liveHub'
import { createStreamRoute } from './streamRoute'

type Joined = { symbols: string[]; send: (ticks: LiveTick[]) => void; left: boolean }

const tick: LiveTick = { symbol: 'AAPL', price: 353.2, change: 4.1, changePercent: 1.18, time: 1795532303000, session: 'regular', volume: 100 }

const servers: Server[] = []
const aborts: AbortController[] = []

const fakeHub = (size = 0) => {
  const joined: Joined[] = []
  const hub: LiveHub = {
    join: (symbols, send) => {
      const entry: Joined = { symbols, send, left: false }
      joined.push(entry)
      return () => {
        entry.left = true
      }
    },
    push: () => undefined,
    size: () => size + joined.filter((entry) => !entry.left).length,
  }
  return { hub, joined }
}

const start = async (hub: LiveHub, keepAliveMs?: number): Promise<string> => {
  const route = createStreamRoute({ hub, keepAliveMs })
  const server = createServer((req, res) => route(req, res, new URL(req.url ?? '/', 'http://127.0.0.1').searchParams))
  servers.push(server)
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const open = async (url: string) => {
  const abort = new AbortController()
  aborts.push(abort)
  const response = await fetch(url, { signal: abort.signal })
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  let text = ''
  const until = async (wanted: string): Promise<string> => {
    const deadline = Date.now() + 2000
    while (!text.includes(wanted) && Date.now() < deadline) {
      const chunk = await reader?.read()
      if (!chunk || chunk.done) break
      text += decoder.decode(chunk.value, { stream: true })
    }
    return text
  }
  return { response, until, abort }
}

const waitFor = async (check: () => boolean): Promise<void> => {
  const deadline = Date.now() + 2000
  while (!check() && Date.now() < deadline) await new Promise((done) => setTimeout(done, 10))
}

afterEach(async () => {
  aborts.splice(0).forEach((abort) => abort.abort())
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((done) => {
          server.closeAllConnections()
          server.close(() => done())
        }),
    ),
  )
})

test('Should answer with an event stream that tells the browser when to reconnect', async () => {
  const { hub } = fakeHub()
  const { response, until } = await open(`${await start(hub)}/api/stream?symbols=AAPL`)
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await until('\n\n')).toBe('retry: 3000\n\n')
})

test('Should join with the valid symbols in capitals and without repeats', async () => {
  const { hub, joined } = fakeHub()
  await open(`${await start(hub)}/api/stream?symbols=aapl,KO,%3Cscript%3E,AAPL,BRK-B`)
  expect(joined.map((entry) => entry.symbols)).toEqual([['AAPL', 'KO', 'BRK-B']])
})

test('Should send each batch of ticks as one event', async () => {
  const { hub, joined } = fakeHub()
  const { until } = await open(`${await start(hub)}/api/stream?symbols=AAPL`)
  joined[0].send([tick])
  const text = await until('data: ')
  expect(text).toContain(`data: ${JSON.stringify([tick])}\n\n`)
})

test('Should leave when the browser closes the stream', async () => {
  const { hub, joined } = fakeHub()
  const { abort, until } = await open(`${await start(hub)}/api/stream?symbols=AAPL`)
  await until('retry')
  abort.abort()
  await waitFor(() => joined[0].left)
  expect(joined[0].left).toBe(true)
})

test('Should not fail when ticks arrive for a stream that already closed', async () => {
  const { hub, joined } = fakeHub()
  const { abort, until } = await open(`${await start(hub)}/api/stream?symbols=AAPL`)
  await until('retry')
  abort.abort()
  await waitFor(() => joined[0].left)
  expect(() => joined[0].send([tick])).not.toThrow()
  await new Promise((done) => setTimeout(done, 30))
})

test('Should send a comment now and then so the connection stays open', async () => {
  const { hub } = fakeHub()
  const { until } = await open(`${await start(hub, 20)}/api/stream?symbols=AAPL`)
  expect(await until(': keep\n\n')).toContain(': keep\n\n')
})

test('Should refuse a stream without any valid symbol', async () => {
  const { hub, joined } = fakeHub()
  const response = await fetch(`${await start(hub)}/api/stream?symbols=%3Cscript%3E`)
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: 'invalid_symbols' })
  expect(joined).toEqual([])
})

test('Should refuse a new stream when sixteen are already open', async () => {
  const { hub, joined } = fakeHub(16)
  const response = await fetch(`${await start(hub)}/api/stream?symbols=AAPL`)
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'busy' })
  expect(joined).toEqual([])
})

test('Should follow at most two hundred symbols per stream', async () => {
  const { hub, joined } = fakeHub()
  const symbols = Array.from({ length: 230 }, (_, index) => `S${index}`).join(',')
  await open(`${await start(hub)}/api/stream?symbols=${symbols}`)
  expect(joined[0].symbols).toHaveLength(200)
})
