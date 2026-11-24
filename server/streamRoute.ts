import type { IncomingMessage, ServerResponse } from 'node:http'
import { SYMBOL_PATTERN } from '../shared/symbols'
import type { LiveHub } from './liveHub'

type StreamDeps = { hub: LiveHub; keepAliveMs?: number }

export const MAX_STREAM_CLIENTS = 16

const MAX_CLIENT_SYMBOLS = 200
const KEEP_ALIVE_MS = 20_000
const RECONNECT_MS = 3_000
const MAX_BUFFERED_BYTES = 1_000_000

const symbolsOf = (query: URLSearchParams): string[] => [
  ...new Set(
    (query.get('symbols') ?? '')
      .split(',')
      .filter((symbol) => SYMBOL_PATTERN.test(symbol))
      .map((symbol) => symbol.toUpperCase()),
  ),
].slice(0, MAX_CLIENT_SYMBOLS)

const refuse = (res: ServerResponse, status: number, error: string): void => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ error }))
}

export const createStreamRoute =
  ({ hub, keepAliveMs = KEEP_ALIVE_MS }: StreamDeps) =>
  (_req: IncomingMessage, res: ServerResponse, query: URLSearchParams): void => {
    const symbols = symbolsOf(query)
    if (symbols.length === 0) {
      refuse(res, 400, 'invalid_symbols')
      return
    }
    if (hub.size() >= MAX_STREAM_CLIENTS) {
      refuse(res, 503, 'busy')
      return
    }

    const write = (text: string): void => {
      if (res.destroyed || res.writableEnded) return
      if (res.writableLength > MAX_BUFFERED_BYTES) {
        res.destroy()
        return
      }
      res.write(text)
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    })
    write(`retry: ${RECONNECT_MS}\n\n`)
    const leave = hub.join(symbols, (ticks) => write(`data: ${JSON.stringify(ticks)}\n\n`))
    const keepAlive = setInterval(() => write(': keep\n\n'), keepAliveMs)
    res.on('error', () => undefined)
    res.on('close', () => {
      clearInterval(keepAlive)
      leave()
    })
  }
