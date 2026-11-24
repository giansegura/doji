import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { History } from '../shared/types'
import { addDays } from '../shared/dates'
import type { DataProvider } from './provider/yahoo'

export type HistoryCache = {
  get: (symbol: string) => Promise<History>
  peek: (symbol: string) => Promise<History>
}

export const FRESH_MS = 15_000
export const FULL_REFRESH_MS = 12 * 60 * 60 * 1000
export const TAIL_DAYS = 10
export const DISK_WRITE_MS = 60_000
export const REDOWNLOAD_MIN_MS = 10 * 60_000

const OVERLAP_TOLERANCE = 0.01

type Entry = { history: History; fullAt: number }

type Download = { history: History; whole: boolean }

const byDate = <T>(dateOf: (item: T) => string) => (a: T, b: T): number => dateOf(a).localeCompare(dateOf(b))

const isHistory = (value: unknown): value is History => {
  const candidate = value as Partial<History> | null
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.info?.symbol === 'string' &&
    Array.isArray(candidate.bars) &&
    Array.isArray(candidate.splits) &&
    typeof candidate.fetchedAt === 'string'
  )
}

const toEntry = (saved: History & { fullAt?: unknown }): Entry => {
  const { fullAt, ...history } = saved
  const parsed = typeof fullAt === 'string' ? Date.parse(fullAt) : Number.NaN
  return { history, fullAt: Number.isNaN(parsed) ? Date.parse(history.fetchedAt) : parsed }
}

const hasUnknownSplit = (cached: History, tail: History): boolean =>
  tail.splits.some((split) => !cached.splits.some((known) => known.date === split.date))

const agrees = (known: number, fresh: number): boolean => Math.abs(fresh - known) <= OVERLAP_TOLERANCE * Math.abs(known)

export const continuesHistory = (cached: History, tail: History): boolean => {
  const last = cached.bars.at(-1)
  const times = tail.bars.map((bar) => bar.time)
  if (!last || times.length === 0) return true
  if (times.every((time) => time > last.time)) return false
  const known = new Map(cached.bars.slice(-tail.bars.length - TAIL_DAYS).map((bar) => [bar.time, bar.close]))
  return tail.bars.every((bar) => {
    const before = known.get(bar.time)
    return bar.time >= last.time || before === undefined || agrees(before, bar.close)
  })
}

export const mergeHistory = (cached: History, tail: History): History => {
  const fresh = [...tail.bars].sort(byDate((bar) => bar.time))
  const from = fresh[0]?.time
  const kept = from === undefined ? cached.bars : cached.bars.filter((bar) => bar.time < from)
  const splits = new Map([...cached.splits, ...tail.splits].map((split) => [split.date, split]))
  return {
    info: tail.info,
    bars: [...kept, ...fresh],
    splits: [...splits.values()].sort(byDate((split) => split.date)),
    fetchedAt: tail.fetchedAt,
    stale: false,
  }
}

export const createHistoryCache = (deps: { provider: DataProvider; dir: string; now: () => Date }): HistoryCache => {
  const inFlight = new Map<string, Promise<History>>()
  const memory = new Map<string, Entry>()
  const writtenAt = new Map<string, number>()
  const distrustedAt = new Map<string, number>()

  const fileFor = (symbol: string): string => join(deps.dir, `${encodeURIComponent(symbol)}.json`)

  const nowMs = (): number => deps.now().getTime()

  const readDisk = async (symbol: string): Promise<Entry | null> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(fileFor(symbol), 'utf8'))
      return isHistory(parsed) ? toEntry(parsed) : null
    } catch {
      return null
    }
  }

  const readCached = async (symbol: string): Promise<Entry | null> => {
    const remembered = memory.get(symbol)
    if (remembered) return remembered
    const saved = await readDisk(symbol)
    if (saved) memory.set(symbol, saved)
    return saved
  }

  const write = async (symbol: string, entry: Entry, whole: boolean): Promise<void> => {
    const now = nowMs()
    if (!whole && now - (writtenAt.get(symbol) ?? 0) < DISK_WRITE_MS) return
    const file = fileFor(symbol)
    await mkdir(deps.dir, { recursive: true })
    await writeFile(`${file}.tmp`, JSON.stringify({ ...entry.history, fullAt: new Date(entry.fullAt).toISOString() }))
    await rename(`${file}.tmp`, file)
    writtenAt.set(symbol, now)
  }

  const download = async (symbol: string, cached: Entry | null): Promise<Download> => {
    const lastBar = cached?.history.bars.at(-1)
    if (!cached || !lastBar || !(nowMs() - cached.fullAt < FULL_REFRESH_MS)) {
      return { history: await deps.provider.history(symbol), whole: true }
    }
    const tail = await deps.provider.history(symbol, addDays(lastBar.time, -TAIL_DAYS))
    const suspect = hasUnknownSplit(cached.history, tail) || !continuesHistory(cached.history, tail)
    const sinceDistrust = nowMs() - (distrustedAt.get(symbol) ?? Number.NEGATIVE_INFINITY)
    if (!suspect || sinceDistrust < REDOWNLOAD_MIN_MS) return { history: mergeHistory(cached.history, tail), whole: false }
    distrustedAt.set(symbol, nowMs())
    return { history: await deps.provider.history(symbol), whole: true }
  }

  const refresh = async (symbol: string, cached: Entry | null): Promise<History> => {
    const fresh = await download(symbol, cached)
    const entry = { history: fresh.history, fullAt: fresh.whole || !cached ? nowMs() : cached.fullAt }
    memory.set(symbol, entry)
    await write(symbol, entry, fresh.whole).catch(() => undefined)
    return fresh.history
  }

  const load = async (symbol: string): Promise<History> => {
    const cached = await readCached(symbol)
    if (cached && nowMs() - Date.parse(cached.history.fetchedAt) < FRESH_MS) return cached.history
    try {
      return await refresh(symbol, cached)
    } catch (error) {
      if (!cached) throw error
      return { ...cached.history, stale: true }
    }
  }

  const get = (symbol: string): Promise<History> => {
    const key = symbol.toUpperCase()
    const running = inFlight.get(key)
    if (running) return running
    const started = load(key).finally(() => inFlight.delete(key))
    inFlight.set(key, started)
    return started
  }

  const peek = async (symbol: string): Promise<History> => {
    const kept = await readCached(symbol.toUpperCase())
    return kept ? kept.history : get(symbol)
  }

  return { get, peek }
}
