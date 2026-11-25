import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import sirv from 'sirv'
import { alertMessage } from './alertMessage'
import { createAlertMonitor } from './alertMonitor'
import { createAlertBus, createAlertStreamRoute } from './alertStream'
import { writeAtomic } from './atomicWrite'
import { createHistoryCache } from './historyCache'
import { createLiveHub } from './liveHub'
import { withTimeout } from './net'
import { LOGO_SOURCES_VERSION, fallbackLogoUrl, finnhubLogoUrl, isUsableLogo } from './logoSources'
import { type ImageFetchLike, createImageFetcher, createLogoStore } from './logoStore'
import { type EarningsFetch, createEarningsSource } from './provider/earnings'
import { type FetchLike, createYahooProvider } from './provider/yahoo'
import { type SocketLike, createYahooStream } from './provider/yahooStream'
import { createQuoteCache } from './quoteCache'
import { createApi, expectsBody, isLocalHost, isOwnRequest, parseRequestUrl } from './routes'
import { type StateStore, createStateStore } from './stateStore'
import { createStreamRoute } from './streamRoute'
import { type TelegramFetch, createTelegram } from './telegram'
import { removeFile, testHooksOn } from './serverEnv'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT ?? 4780)
const MAX_BODY_BYTES = 5 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 8000
const dataDir = resolve(process.env.DOJI_DATA_DIR ?? 'data')
const distDir = resolve('dist')

const offlineFetch: FetchLike = async () => {
  throw new Error('offline')
}

const networkFetch: FetchLike = withTimeout((url, init) => fetch(url, init), REQUEST_TIMEOUT_MS)

const offlineImageFetch: ImageFetchLike = async () => {
  throw new Error('offline')
}

const networkImageFetch: ImageFetchLike = withTimeout((url, init) => fetch(url, init), REQUEST_TIMEOUT_MS)

const fetchLogo = createImageFetcher(process.env.DOJI_OFFLINE ? offlineImageFetch : networkImageFetch)

const provider = createYahooProvider({
  fetch: process.env.DOJI_OFFLINE ? offlineFetch : networkFetch,
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  now: () => new Date(),
})

const quotes = createQuoteCache({ fetch: provider.quotes, now: () => new Date() })

const offlineEarningsFetch: EarningsFetch = async () => {
  throw new Error('offline')
}

const earningsFile = join(dataDir, 'cache', 'earnings.json')

const networkEarningsFetch: EarningsFetch = withTimeout((url, init) => fetch(url, init), REQUEST_TIMEOUT_MS)

const stateStore = createStateStore(join(dataDir, 'state.json'))

const telegramFile = join(dataDir, 'telegram.json')

const telegramFetch: TelegramFetch = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

const offlineTelegramFetch: TelegramFetch = async () => {
  throw new Error('offline')
}

const telegram = createTelegram({
  fetch: process.env.DOJI_OFFLINE && !process.env.DOJI_TELEGRAM_API ? offlineTelegramFetch : telegramFetch,
  apiUrl: process.env.DOJI_TELEGRAM_API ?? 'https://api.telegram.org',
  store: {
    load: async () => JSON.parse(await readFile(telegramFile, 'utf8')),
    save: async (config) => {
      await mkdir(dataDir, { recursive: true })
      await writeAtomic(telegramFile, JSON.stringify(config))
    },
    clear: () => removeFile(telegramFile),
  },
})

const alertBus = createAlertBus()

const alertMonitor = createAlertMonitor({
  read: stateStore.read,
  save: stateStore.save,
  join: (symbols, send) => liveHub.join(symbols, send),
  quotes: (symbols) => quotes.get(symbols),
  announce: (alerts) => {
    alertBus.publish(alerts)
    alerts.forEach((alert) => {
      telegram.send(alertMessage(alert)).catch(() => undefined)
    })
  },
  now: () => new Date(),
  every: (run, ms) => {
    const timer = setInterval(run, ms)
    return () => clearInterval(timer)
  },
  newId: randomUUID,
})

const watchedState: StateStore = {
  read: stateStore.read,
  save: async (state, baseRev) => {
    const outcome = await stateStore.save(state, baseRev)
    if (outcome.ok) alertMonitor.stateSaved({ ...state, rev: outcome.rev })
    return outcome
  },
}

const api = createApi({
  history: createHistoryCache({ provider, dir: join(dataDir, 'cache'), now: () => new Date() }),
  provider: { ...provider, quotes: quotes.get },
  state: watchedState,
  telegram,
  ...(testHooksOn(process.env) ? { testPrices: (prices: Record<string, number>) => alertMonitor.check(prices) } : {}),
  earnings: createEarningsSource({
    fetch: process.env.DOJI_OFFLINE ? offlineEarningsFetch : networkEarningsFetch,
    now: () => new Date(),
    store: {
      load: async () => JSON.parse(await readFile(earningsFile, 'utf8')),
      save: async (data) => {
        await mkdir(dirname(earningsFile), { recursive: true })
        await writeAtomic(earningsFile, JSON.stringify(data))
      },
    },
  }),
  logos: createLogoStore({
    sources: [finnhubLogoUrl, provider.logoUrl, fallbackLogoUrl],
    fetchImage: async (url) => {
      const logo = await fetchLogo(url)
      return logo && isUsableLogo(url, logo) ? logo : null
    },
    dir: join(dataDir, 'cache', 'logos'),
    now: () => new Date(),
    version: LOGO_SOURCES_VERSION,
  }),
})

const openSocket = (url: string): SocketLike => {
  const socket = new WebSocket(url)
  return {
    send: (data) => socket.send(data),
    close: () => socket.close(),
    addEventListener: (type, listener) =>
      socket.addEventListener(type, (event) => listener({ data: 'data' in event ? event.data : undefined })),
  }
}

const timers = {
  setTimer: (run: () => void, ms: number): unknown => setTimeout(run, ms),
  clearTimer: (timer: unknown): void => clearTimeout(timer as ReturnType<typeof setTimeout>),
}

const liveHub = createLiveHub({ now: () => Date.now(), watch: (symbols) => liveStream?.setSymbols(symbols), ...timers })

const liveStream = process.env.DOJI_OFFLINE ? null : createYahooStream({ connect: openSocket, onTick: liveHub.push, ...timers })

const streamRoute = createStreamRoute({ hub: liveHub })

const alertStreamRoute = createAlertStreamRoute({ bus: alertBus })

const serveStatic = sirv(distDir, { single: true, dev: true })

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

const sendText = (res: ServerResponse, status: number, text: string): void => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(text)
}

const readBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((done, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body_too_large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        done(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    req.on('error', reject)
  })

const handleApi = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> => {
  const method = req.method ?? 'GET'
  const body = expectsBody(method) ? await readBody(req).catch(() => undefined) : null
  if (body === undefined) {
    sendJson(res, 400, { error: 'invalid_body' })
    return
  }
  const result = await api({ method, path: url.pathname, query: url.searchParams, body })
  if ('image' in result) {
    res.writeHead(200, {
      'Content-Type': result.image.contentType,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(result.image.bytes)
    return
  }
  sendJson(res, result.status, result.body)
}

const handleRequest = (req: IncomingMessage, res: ServerResponse): void => {
  if (!isLocalHost(req.headers.host)) {
    sendJson(res, 403, { error: 'forbidden' })
    return
  }
  const url = parseRequestUrl(req.url)
  if (!url) {
    sendJson(res, 400, { error: 'invalid_request' })
    return
  }
  if (url.pathname.startsWith('/api/') && !isOwnRequest(req.headers['sec-fetch-site'])) {
    sendJson(res, 403, { error: 'forbidden' })
    return
  }
  if (url.pathname === '/api/stream' && req.method === 'GET') {
    streamRoute(req, res, url.searchParams)
    return
  }
  if (url.pathname === '/api/alerts/stream' && req.method === 'GET') {
    alertStreamRoute(req, res)
    return
  }
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch(() => sendJson(res, 500, { error: 'internal' }))
    return
  }
  serveStatic(req, res, () =>
    sendText(
      res,
      404,
      existsSync(distDir) ? 'Not found' : 'The app is not built. Run "npm start" or use "npm run dev".',
    ),
  )
}

const server = createServer((req, res) => {
  try {
    handleRequest(req, res)
  } catch {
    if (!res.headersSent) sendJson(res, 500, { error: 'internal' })
  }
})

server.on('error', (error) => {
  console.error(`Could not start on http://${HOST}:${PORT}: ${error.message}`)
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  console.log(`doji at http://${HOST}:${PORT}`)
  console.log(`data in ${dataDir}`)
  alertMonitor.start().catch(() => undefined)
})
