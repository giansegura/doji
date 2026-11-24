import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, expect, test } from 'vitest'
import type { AlertEvent } from '../shared/types'
import { createAlertBus, createAlertStreamRoute } from './alertStream'

const alert: AlertEvent = { id: 'a1', symbol: 'KO', level: 60, price: 60.2, direction: 'up', at: '2026-11-24T15:00:00.000Z', text: 'R1' }

const servers: Server[] = []
const aborts: AbortController[] = []

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

const start = async (route: ReturnType<typeof createAlertStreamRoute>): Promise<string> => {
  const server = createServer((req, res) => route(req, res))
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
  return { response, until }
}

test('Should hand every published alert to every listener until it leaves', () => {
  const bus = createAlertBus()
  const heard: AlertEvent[][] = []
  const leave = bus.subscribe((alerts) => heard.push(alerts))
  bus.publish([alert])
  leave()
  bus.publish([alert])
  expect(heard).toEqual([[alert]])
})

test('Should send the alerts to the open pages as an event stream', async () => {
  const bus = createAlertBus()
  const { response, until } = await open(await start(createAlertStreamRoute({ bus })))
  expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
  expect(await until('retry')).toContain('retry: 3000')
  bus.publish([alert])
  expect(await until('KO')).toContain(`data: ${JSON.stringify([alert])}\n\n`)
})

test('Should stop listening when the page goes away and refuse too many pages', async () => {
  const bus = createAlertBus()
  const url = await start(createAlertStreamRoute({ bus, maxClients: 1 }))
  const first = await open(url)
  await first.until('retry')
  expect(bus.size()).toBe(1)
  expect((await fetch(url)).status).toBe(503)
  aborts.splice(0).forEach((abort) => abort.abort())
  const deadline = Date.now() + 2000
  while (bus.size() > 0 && Date.now() < deadline) await new Promise((done) => setTimeout(done, 10))
  expect(bus.size()).toBe(0)
})
