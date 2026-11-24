import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type Logo = { bytes: Buffer; contentType: string }

export type LogoStore = { get: (symbol: string) => Promise<Logo | null> }

export type LogoSource = (symbol: string) => Promise<string | null>

export type ImageFetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{
  status: number
  headers: { get: (name: string) => string | null }
  arrayBuffer: () => Promise<ArrayBuffer>
}>

type Meta = { fetchedAt: string; contentType: string | null }

type Lookup = { logo: Logo | null; certain: boolean }

const DAY_MS = 24 * 60 * 60 * 1000
const KEEP_MS = 30 * DAY_MS
const MISSING_MS = 7 * DAY_MS
const MAX_BYTES = 512 * 1024
const LOGO_HOSTS = ['s.yimg.com', 'financialmodelingprep.com']
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const IMAGE_HEADERS = { 'User-Agent': 'Mozilla/5.0' }

export const isAllowedLogoUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && LOGO_HOSTS.includes(parsed.hostname)
  } catch {
    return false
  }
}

export const createImageFetcher =
  (fetchLike: ImageFetchLike) =>
  async (url: string): Promise<Logo | null> => {
    if (!isAllowedLogoUrl(url)) return null
    const response = await fetchLike(url, { headers: IMAGE_HEADERS })
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (response.status !== 200 || !IMAGE_TYPES.includes(contentType)) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null
    return { bytes, contentType }
  }

export const createLogoStore = (deps: {
  sources: LogoSource[]
  fetchImage: (url: string) => Promise<Logo | null>
  dir: string
  now: () => Date
}): LogoStore => {
  const inFlight = new Map<string, Promise<Logo | null>>()
  let queue: Promise<unknown> = Promise.resolve()

  const pathsFor = (symbol: string) => {
    const base = join(deps.dir, encodeURIComponent(symbol))
    return { image: `${base}.img`, meta: `${base}.json` }
  }

  const readMeta = async (symbol: string): Promise<Meta | null> => {
    try {
      const parsed = JSON.parse(await readFile(pathsFor(symbol).meta, 'utf8')) as Partial<Meta> | null
      if (!parsed || typeof parsed.fetchedAt !== 'string') return null
      return { fetchedAt: parsed.fetchedAt, contentType: typeof parsed.contentType === 'string' ? parsed.contentType : null }
    } catch {
      return null
    }
  }

  const readSaved = async (symbol: string, meta: Meta | null): Promise<Logo | null> => {
    if (!meta?.contentType) return null
    try {
      return { bytes: await readFile(pathsFor(symbol).image), contentType: meta.contentType }
    } catch {
      return null
    }
  }

  const writeAtomic = async (file: string, content: string | Buffer): Promise<void> => {
    await writeFile(`${file}.tmp`, content)
    await rename(`${file}.tmp`, file)
  }

  const save = async (symbol: string, logo: Logo | null): Promise<void> => {
    const paths = pathsFor(symbol)
    await mkdir(deps.dir, { recursive: true })
    if (logo) await writeAtomic(paths.image, logo.bytes)
    await writeAtomic(paths.meta, JSON.stringify({ fetchedAt: deps.now().toISOString(), contentType: logo?.contentType ?? null }))
  }

  const lookup = async (symbol: string): Promise<Lookup> => {
    let certain = true
    for (const source of deps.sources) {
      try {
        const url = await source(symbol)
        const logo = url ? await deps.fetchImage(url) : null
        if (logo) return { logo, certain: true }
      } catch {
        certain = false
      }
    }
    return { logo: null, certain }
  }

  const enqueue = (task: () => Promise<Lookup>): Promise<Lookup> => {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  const isFresh = (meta: Meta, saved: Logo | null): boolean => {
    const age = deps.now().getTime() - Date.parse(meta.fetchedAt)
    if (meta.contentType) return saved !== null && age < KEEP_MS
    return age < MISSING_MS
  }

  const load = async (symbol: string): Promise<Logo | null> => {
    const meta = await readMeta(symbol)
    const saved = await readSaved(symbol, meta)
    if (meta && isFresh(meta, saved)) return saved
    const found = await enqueue(() => lookup(symbol))
    if (found.logo) {
      await save(symbol, found.logo)
      return found.logo
    }
    if (saved) return saved
    if (found.certain) await save(symbol, null)
    return null
  }

  const get = (symbol: string): Promise<Logo | null> => {
    const key = symbol.toUpperCase()
    const running = inFlight.get(key)
    if (running) return running
    const started = load(key).finally(() => inFlight.delete(key))
    inFlight.set(key, started)
    return started
  }

  return { get }
}
