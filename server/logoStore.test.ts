import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { type ImageFetchLike, type Logo, createImageFetcher, createLogoStore, isAllowedLogoUrl } from './logoStore'

const DAY = 24 * 60 * 60 * 1000

const png = (text: string): Logo => ({ bytes: Buffer.from(text), contentType: 'image/png' })

type Source = (symbol: string) => Promise<string | null>

const makeStore = async (sources: Source[], images: Record<string, Logo | null | Error>) => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-logos-'))
  const asked: string[] = []
  const fetched: string[] = []
  let clock = Date.parse('2026-11-23T20:00:00Z')
  let running = 0
  let maxRunning = 0
  const tracked = sources.map((source) => async (symbol: string) => {
    asked.push(symbol)
    running += 1
    maxRunning = Math.max(maxRunning, running)
    await new Promise((done) => setTimeout(done, 5))
    running -= 1
    return source(symbol)
  })
  const store = createLogoStore({
    sources: tracked,
    fetchImage: async (url) => {
      fetched.push(url)
      const image = images[url] ?? null
      if (image instanceof Error) throw image
      return image
    },
    dir,
    now: () => new Date(clock),
  })
  const advance = (ms: number) => {
    clock += ms
  }
  return { store, asked, fetched, dir, advance, maxRunning: () => maxRunning }
}

const none: Source = async () => null
const at = (url: string): Source => async () => url
const broken: Source = async () => {
  throw new Error('sin red')
}

test('Should take the logo from the first source that has one and keep it on disk', async () => {
  const { store, asked, fetched } = await makeStore([none, at('https://b/logo.png')], { 'https://b/logo.png': png('B') })
  const first = await store.get('aapl')
  const second = await store.get('AAPL')
  expect(first).toEqual(png('B'))
  expect(second).toEqual(png('B'))
  expect(asked).toEqual(['AAPL', 'AAPL'])
  expect(fetched).toEqual(['https://b/logo.png'])
})

test('Should not ask the second source when the first one has the logo', async () => {
  const { store, asked } = await makeStore([at('https://a/logo.png'), at('https://b/logo.png')], {
    'https://a/logo.png': png('A'),
    'https://b/logo.png': png('B'),
  })
  expect(await store.get('AAPL')).toEqual(png('A'))
  expect(asked).toEqual(['AAPL'])
})

test('Should try the next source when the image of one is not usable', async () => {
  const { store } = await makeStore([at('https://a/logo.png'), at('https://b/logo.png')], {
    'https://a/logo.png': null,
    'https://b/logo.png': png('B'),
  })
  expect(await store.get('AAPL')).toEqual(png('B'))
})

test('Should remember that a symbol has no logo and ask again only after a week', async () => {
  const { store, asked, advance } = await makeStore([none], {})
  expect(await store.get('KO')).toBe(null)
  expect(await store.get('KO')).toBe(null)
  expect(asked).toHaveLength(1)
  advance(8 * DAY)
  await store.get('KO')
  expect(asked).toHaveLength(2)
})

test('Should not remember a failure caused by the network', async () => {
  const { store, asked } = await makeStore([broken], {})
  expect(await store.get('KO')).toBe(null)
  expect(await store.get('KO')).toBe(null)
  expect(asked).toHaveLength(2)
})

test('Should not remember a missing logo when a later source could not be reached', async () => {
  const { store, asked } = await makeStore([none, broken], {})
  await store.get('KO')
  await store.get('KO')
  expect(asked).toHaveLength(4)
})

test('Should refresh a logo after a month', async () => {
  const { store, fetched, advance } = await makeStore([at('https://a/logo.png')], { 'https://a/logo.png': png('A') })
  await store.get('AAPL')
  advance(29 * DAY)
  await store.get('AAPL')
  expect(fetched).toHaveLength(1)
  advance(2 * DAY)
  await store.get('AAPL')
  expect(fetched).toHaveLength(2)
})

test('Should keep serving the saved logo when a refresh fails', async () => {
  const images: Record<string, Logo | null | Error> = { 'https://a/logo.png': png('A') }
  const { store, advance } = await makeStore([at('https://a/logo.png')], images)
  await store.get('AAPL')
  advance(31 * DAY)
  images['https://a/logo.png'] = new Error('sin red')
  expect(await store.get('AAPL')).toEqual(png('A'))
})

test('Should look up one symbol at a time', async () => {
  const { store, maxRunning } = await makeStore([none], {})
  await Promise.all(['AAPL', 'MSFT', 'NVDA', 'KO'].map((symbol) => store.get(symbol)))
  expect(maxRunning()).toBe(1)
})

test('Should share one lookup between simultaneous requests for the same symbol', async () => {
  const { store, asked } = await makeStore([at('https://a/logo.png')], { 'https://a/logo.png': png('A') })
  const [a, b] = await Promise.all([store.get('AAPL'), store.get('AAPL')])
  expect(asked).toEqual(['AAPL'])
  expect(a).toEqual(b)
})

test('Should keep symbols with dashes and dots apart on disk', async () => {
  const { store, dir } = await makeStore([at('https://a/logo.png')], { 'https://a/logo.png': png('A') })
  await store.get('BRK-B')
  await store.get('BF.B')
  expect((await readdir(dir)).sort()).toEqual(['BF.B.img', 'BF.B.json', 'BRK-B.img', 'BRK-B.json'])
})

test('Should only allow logo addresses on the known image hosts over https', () => {
  expect(isAllowedLogoUrl('https://s.yimg.com/lb/brands/150x150_apple.png')).toBe(true)
  expect(isAllowedLogoUrl('https://financialmodelingprep.com/image-stock/KO.png')).toBe(true)
  expect(isAllowedLogoUrl('https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/KO.png')).toBe(true)
  expect(isAllowedLogoUrl('http://s.yimg.com/lb/brands/150x150_apple.png')).toBe(false)
  expect(isAllowedLogoUrl('https://s.yimg.com.evil.example/logo.png')).toBe(false)
  expect(isAllowedLogoUrl('https://127.0.0.1:4780/api/state')).toBe(false)
  expect(isAllowedLogoUrl('no es una url')).toBe(false)
})

const response = (over: { status?: number; type?: string | null; body?: string }) => ({
  status: over.status ?? 200,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? (over.type === undefined ? 'image/png' : over.type) : null) },
  arrayBuffer: async () => new TextEncoder().encode(over.body ?? 'PNG').buffer as ArrayBuffer,
})

const fetcherFor = (reply: ReturnType<typeof response> | Error) => {
  const urls: string[] = []
  const fetchLike: ImageFetchLike = async (url) => {
    urls.push(url)
    if (reply instanceof Error) throw reply
    return reply
  }
  return { fetchImage: createImageFetcher(fetchLike), urls }
}

const LOGO_URL = 'https://s.yimg.com/lb/brands/150x150_apple.png'

test('Should download an image with its content type', async () => {
  const { fetchImage, urls } = fetcherFor(response({ body: 'PNG' }))
  expect(await fetchImage(LOGO_URL)).toEqual({ bytes: Buffer.from('PNG'), contentType: 'image/png' })
  expect(urls).toEqual([LOGO_URL])
})

test('Should reject what is not an image', async () => {
  expect(await fetcherFor(response({ status: 404 })).fetchImage(LOGO_URL)).toBe(null)
  expect(await fetcherFor(response({ type: 'text/html' })).fetchImage(LOGO_URL)).toBe(null)
  expect(await fetcherFor(response({ type: null })).fetchImage(LOGO_URL)).toBe(null)
  expect(await fetcherFor(response({ type: 'image/svg+xml' })).fetchImage(LOGO_URL)).toBe(null)
})

test('Should reject an image that is too large or empty', async () => {
  expect(await fetcherFor(response({ body: 'x'.repeat(600_000) })).fetchImage(LOGO_URL)).toBe(null)
  expect(await fetcherFor(response({ body: '' })).fetchImage(LOGO_URL)).toBe(null)
})

test('Should not download from an address that is not allowed', async () => {
  const { fetchImage, urls } = fetcherFor(response({}))
  expect(await fetchImage('https://evil.example/logo.png')).toBe(null)
  expect(urls).toEqual([])
})

test('Should let a network failure through as an error', async () => {
  const { fetchImage } = fetcherFor(new Error('ECONNRESET'))
  await expect(fetchImage(LOGO_URL)).rejects.toThrow('ECONNRESET')
})

const versioned = (dir: string, version: string | undefined, url: string, fetched: string[]) =>
  createLogoStore({
    sources: [at(url)],
    fetchImage: async (asked) => {
      fetched.push(asked)
      return asked.includes('missing') ? null : png(asked)
    },
    dir,
    now: () => new Date('2026-11-24T10:00:00Z'),
    version,
  })

test('Should look a logo up again when the sources have changed since it was saved', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-logos-'))
  const fetched: string[] = []
  await versioned(dir, 'one', 'https://a/old.png', fetched).get('AAPL')
  await versioned(dir, 'one', 'https://a/old.png', fetched).get('AAPL')
  expect(fetched).toEqual(['https://a/old.png'])
  const logo = await versioned(dir, 'two', 'https://b/new.png', fetched).get('AAPL')
  expect(fetched).toEqual(['https://a/old.png', 'https://b/new.png'])
  expect(logo?.bytes.toString()).toBe('https://b/new.png')
  await versioned(dir, 'two', 'https://b/new.png', fetched).get('AAPL')
  expect(fetched).toHaveLength(2)
})

test('Should look up again a logo saved before the sources had a version', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-logos-'))
  const fetched: string[] = []
  await versioned(dir, undefined, 'https://a/old.png', fetched).get('AAPL')
  await versioned(dir, 'two', 'https://b/new.png', fetched).get('AAPL')
  expect(fetched).toEqual(['https://a/old.png', 'https://b/new.png'])
})

test('Should keep serving the saved logo when the new sources have none', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-logos-'))
  const fetched: string[] = []
  await versioned(dir, 'one', 'https://a/old.png', fetched).get('AAPL')
  const logo = await versioned(dir, 'two', 'https://b/missing.png', fetched).get('AAPL')
  expect(logo?.bytes.toString()).toBe('https://a/old.png')
})

test('Should ask again for a symbol remembered as having no logo when the sources have changed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-logos-'))
  const fetched: string[] = []
  expect(await versioned(dir, 'one', 'https://a/missing.png', fetched).get('AAPL')).toBeNull()
  const logo = await versioned(dir, 'two', 'https://b/new.png', fetched).get('AAPL')
  expect(logo?.bytes.toString()).toBe('https://b/new.png')
})

test('Should not look a logo up again on every request after the new sources found nothing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-logos-'))
  const fetched: string[] = []
  await versioned(dir, 'one', 'https://a/old.png', fetched).get('AAPL')
  const store = versioned(dir, 'two', 'https://b/missing.png', fetched)
  await store.get('AAPL')
  const again = versioned(dir, 'two', 'https://b/missing.png', fetched)
  expect((await again.get('AAPL'))?.bytes.toString()).toBe('https://a/old.png')
  expect(fetched).toEqual(['https://a/old.png', 'https://b/missing.png'])
})
