import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AlertEvent } from '../shared/types'

type Listener = (alerts: AlertEvent[]) => void

export type AlertBus = { publish: (alerts: AlertEvent[]) => void; subscribe: (listener: Listener) => () => void; size: () => number }

const RECONNECT_MS = 3_000
const KEEP_ALIVE_MS = 20_000
const MAX_CLIENTS = 16

export const createAlertBus = (): AlertBus => {
  const listeners = new Set<Listener>()
  return {
    publish: (alerts) =>
      listeners.forEach((listener) => {
        try {
          listener(alerts)
        } catch {
          listeners.delete(listener)
        }
      }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    size: () => listeners.size,
  }
}

export const createAlertStreamRoute =
  ({ bus, keepAliveMs = KEEP_ALIVE_MS, maxClients = MAX_CLIENTS }: { bus: AlertBus; keepAliveMs?: number; maxClients?: number }) =>
  (_req: IncomingMessage, res: ServerResponse): void => {
    if (bus.size() >= maxClients) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ error: 'busy' }))
      return
    }
    const write = (text: string): void => {
      if (!res.destroyed && !res.writableEnded) res.write(text)
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' })
    write(`retry: ${RECONNECT_MS}\n\n`)
    const leave = bus.subscribe((alerts) => write(`data: ${JSON.stringify(alerts)}\n\n`))
    const keepAlive = setInterval(() => write(': keep\n\n'), keepAliveMs)
    res.on('error', () => undefined)
    res.on('close', () => {
      clearInterval(keepAlive)
      leave()
    })
  }
