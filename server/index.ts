import { existsSync } from 'node:fs'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import { join, resolve } from 'node:path'
import sirv from 'sirv'
import { createHistoryCache } from './historyCache'
import { withTimeout } from './net'
import { type ImageFetchLike, createImageFetcher, createLogoStore } from './logoStore'
import { type FetchLike, createYahooProvider } from './provider/yahoo'
import { createQuoteCache } from './quoteCache'
import { createApi, expectsBody, isLocalHost, isOwnRequest, parseRequestUrl } from './routes'
import { createStateStore } from './stateStore'

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

const fallbackLogoUrl = async (symbol: string): Promise<string> =>
  `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`

const provider = createYahooProvider({
  fetch: process.env.DOJI_OFFLINE ? offlineFetch : networkFetch,
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  now: () => new Date(),
})

const quotes = createQuoteCache({ fetch: provider.quotes, now: () => new Date() })

const api = createApi({
  history: createHistoryCache({ provider, dir: join(dataDir, 'cache'), now: () => new Date() }),
  provider: { ...provider, quotes: quotes.get },
  state: createStateStore(join(dataDir, 'state.json')),
  logos: createLogoStore({
    sources: [provider.logoUrl, fallbackLogoUrl],
    fetchImage: createImageFetcher(process.env.DOJI_OFFLINE ? offlineImageFetch : networkImageFetch),
    dir: join(dataDir, 'cache', 'logos'),
    now: () => new Date(),
  }),
})

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
})
