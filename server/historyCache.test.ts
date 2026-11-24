import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import type { Bar, History, Split } from '../shared/types'
import { createHistoryCache, mergeHistory } from './historyCache'
import { type DataProvider, isProviderError, providerError } from './provider/yahoo'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const bar = (time: string, close: number): Bar => ({ time, open: close, high: close, low: close, close, volume: 1 })

const history = (bars: Bar[], splits: Split[] = [], fetchedAt = 'x'): History => ({
  info: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  bars,
  splits,
  fetchedAt,
  stale: false,
})

const full = history([bar('2026-11-19', 10), bar('2026-11-20', 11)])
const tail = history([bar('2026-11-20', 11.5), bar('2026-11-23', 12)])

const makeCache = async (responses: (History | Error)[], over: { dir?: string } = {}) => {
  const dir = over.dir ?? (await mkdtemp(join(tmpdir(), 'doji-cache-')))
  const calls: { symbol: string; fromDate?: string }[] = []
  let clock = Date.parse('2026-11-23T20:00:00Z')
  const provider: DataProvider = {
    history: async (symbol, fromDate) => {
      const response = responses[Math.min(calls.length, responses.length - 1)]
      calls.push({ symbol, fromDate })
      if (response instanceof Error) throw response
      return { ...response, fetchedAt: new Date(clock).toISOString() }
    },
    search: async () => [],
    quotes: async () => [],
    logoUrl: async () => null,
  }
  const cache = createHistoryCache({ provider, dir, now: () => new Date(clock) })
  const advance = (ms: number) => {
    clock += ms
  }
  return { cache, calls, dir, advance, provider, now: () => new Date(clock) }
}

test('Should download the full history once and reuse it while fresh', async () => {
  const { cache, calls, advance } = await makeCache([full])
  const first = await cache.get('AAPL')
  advance(10_000)
  const second = await cache.get('AAPL')
  expect(calls).toEqual([{ symbol: 'AAPL', fromDate: undefined }])
  expect(first.bars).toEqual(full.bars)
  expect(second).toEqual(first)
})

test('Should refresh the tail once fifteen seconds have passed', async () => {
  const { cache, calls, advance } = await makeCache([full, tail])
  await cache.get('AAPL')
  advance(16_000)
  await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, '2026-11-10'])
})

test('Should refresh only the tail after a minute and merge it', async () => {
  const { cache, calls, advance } = await makeCache([full, tail])
  await cache.get('AAPL')
  advance(61_000)
  const refreshed = await cache.get('AAPL')
  expect(calls[1]).toEqual({ symbol: 'AAPL', fromDate: '2026-11-10' })
  expect(refreshed.bars).toEqual([bar('2026-11-19', 10), bar('2026-11-20', 11.5), bar('2026-11-23', 12)])
  expect(refreshed.fetchedAt).toBe('2026-11-23T20:01:01.000Z')
  expect(refreshed.stale).toBe(false)
})

test('Should persist the merged history for the next read', async () => {
  const { cache, calls, advance } = await makeCache([full, tail])
  await cache.get('AAPL')
  advance(61_000)
  await cache.get('AAPL')
  advance(10_000)
  const third = await cache.get('AAPL')
  expect(calls).toHaveLength(2)
  expect(third.bars).toHaveLength(3)
})

test('Should write the cache to disk at most once a minute but always answer with the latest', async () => {
  const { cache, dir, advance } = await makeCache([full, tail])
  const onDisk = async () => (JSON.parse(await readFile(join(dir, 'AAPL.json'), 'utf8')) as History).fetchedAt
  await cache.get('AAPL')
  expect(await onDisk()).toBe('2026-11-23T20:00:00.000Z')
  advance(16_000)
  const refreshed = await cache.get('AAPL')
  expect(refreshed.fetchedAt).toBe('2026-11-23T20:00:16.000Z')
  expect(refreshed.bars).toHaveLength(3)
  expect(await onDisk()).toBe('2026-11-23T20:00:00.000Z')
  advance(50_000)
  await cache.get('AAPL')
  expect(await onDisk()).toBe('2026-11-23T20:01:06.000Z')
})

test('Should read the cache from disk again after a restart', async () => {
  const first = await makeCache([full])
  await first.cache.get('AAPL')
  const calls: string[] = []
  const restarted = createHistoryCache({
    provider: {
      history: async (symbol) => {
        calls.push(symbol)
        return full
      },
      search: async () => [],
      quotes: async () => [],
      logoUrl: async () => null,
    },
    dir: first.dir,
    now: () => new Date('2026-11-23T20:00:05Z'),
  })
  expect((await restarted.get('AAPL')).bars).toEqual(full.bars)
  expect(calls).toEqual([])
})

test('Should download everything again when the tail reveals an unknown split', async () => {
  const split: Split = { date: '2026-11-23', numerator: 2, denominator: 1 }
  const rescaled = history([bar('2026-11-19', 5), bar('2026-11-20', 5.5), bar('2026-11-23', 6)], [split])
  const { cache, calls, advance } = await makeCache([full, history(tail.bars, [split]), rescaled])
  await cache.get('AAPL')
  advance(61_000)
  const refreshed = await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, '2026-11-10', undefined])
  expect(refreshed.bars).toEqual(rescaled.bars)
  expect(refreshed.splits).toEqual([split])
})

test('Should not download everything again for a split it already knows', async () => {
  const split: Split = { date: '2026-11-19', numerator: 2, denominator: 1 }
  const { cache, calls, advance } = await makeCache([history(full.bars, [split]), history(tail.bars, [split])])
  await cache.get('AAPL')
  advance(61_000)
  const refreshed = await cache.get('AAPL')
  expect(calls).toHaveLength(2)
  expect(refreshed.splits).toEqual([split])
})

test('Should download everything again after twelve hours', async () => {
  const { cache, calls, advance } = await makeCache([full])
  await cache.get('AAPL')
  advance(13 * HOUR)
  await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, undefined])
})

test('Should serve the cached history as stale when the provider fails', async () => {
  const { cache, advance } = await makeCache([full, providerError('unavailable', 'sin red')])
  const first = await cache.get('AAPL')
  advance(61_000)
  const second = await cache.get('AAPL')
  expect(second.stale).toBe(true)
  expect(second.bars).toEqual(first.bars)
  expect(second.fetchedAt).toBe(first.fetchedAt)
})

test('Should propagate the error when there is no cache', async () => {
  const { cache } = await makeCache([providerError('unavailable', 'sin red')])
  const error = await cache.get('AAPL').catch((reason: unknown) => reason)
  expect(isProviderError(error) && error.kind).toBe('unavailable')
})

test('Should not cache a symbol that does not exist', async () => {
  const { cache, dir } = await makeCache([providerError('not_found', 'no existe')])
  await cache.get('NOEXISTE').catch(() => null)
  expect(await readdir(dir)).toEqual([])
})

test('Should cache symbols with dashes and dots under an upper-case name', async () => {
  const { cache, calls, dir } = await makeCache([full])
  await cache.get('brk-b')
  await cache.get('BF.B')
  expect(calls.map((call) => call.symbol)).toEqual(['BRK-B', 'BF.B'])
  expect((await readdir(dir)).sort()).toEqual(['BF.B.json', 'BRK-B.json'])
})

test('Should ignore an unreadable cache file and download again', async () => {
  const { cache, calls, dir } = await makeCache([full])
  await writeFile(join(dir, 'AAPL.json'), '{not json')
  const out = await cache.get('AAPL')
  expect(calls).toHaveLength(1)
  expect(out.bars).toEqual(full.bars)
})

test('Should share one download between simultaneous requests', async () => {
  const { cache, calls } = await makeCache([full])
  const [a, b] = await Promise.all([cache.get('AAPL'), cache.get('AAPL')])
  expect(calls).toHaveLength(1)
  expect(a).toEqual(b)
})

test('Should replace bars of the same date and append new ones when merging', () => {
  const merged = mergeHistory(history(full.bars, [], 'old'), history(tail.bars, [], 'new'))
  expect(merged.bars.map((b) => [b.time, b.close])).toEqual([
    ['2026-11-19', 10],
    ['2026-11-20', 11.5],
    ['2026-11-23', 12],
  ])
  expect(merged.fetchedAt).toBe('new')
})

test('Should keep the cached bars when the tail comes back empty', () => {
  expect(mergeHistory(full, history([])).bars).toEqual(full.bars)
})

test('Should drop the cached bars that the tail no longer has', () => {
  const cached = history([bar('2026-11-19', 10), bar('2026-11-20', 11), bar('2026-11-23', 11)])
  const merged = mergeHistory(cached, history([bar('2026-11-19', 10), bar('2026-11-20', 11)]))
  expect(merged.bars.map((b) => b.time)).toEqual(['2026-11-19', '2026-11-20'])
})

test('Should keep the cached bars that come before the tail', () => {
  const cached = history([bar('2026-11-18', 9), bar('2026-11-19', 10), bar('2026-11-20', 11)])
  const merged = mergeHistory(cached, history([bar('2026-11-23', 12), bar('2026-11-20', 11.5)]))
  expect(merged.bars.map((b) => [b.time, b.close])).toEqual([
    ['2026-11-18', 9],
    ['2026-11-19', 10],
    ['2026-11-20', 11.5],
    ['2026-11-23', 12],
  ])
})

test('Should download everything again when the tail does not reach the cached bars', async () => {
  const later = history([bar('2026-11-23', 12)])
  const whole = history([bar('2026-11-19', 10), bar('2026-11-23', 12)])
  const { cache, calls, advance } = await makeCache([full, later, whole])
  await cache.get('AAPL')
  advance(61_000)
  const refreshed = await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, '2026-11-10', undefined])
  expect(refreshed.bars).toEqual(whole.bars)
})

test('Should download everything again when the tail disagrees with the cached bars', async () => {
  const rebased = history([bar('2026-11-19', 5), bar('2026-11-20', 5.5), bar('2026-11-23', 6)])
  const { cache, calls, advance } = await makeCache([full, rebased, rebased])
  await cache.get('AAPL')
  advance(61_000)
  const refreshed = await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, '2026-11-10', undefined])
  expect(refreshed.bars).toEqual(rebased.bars)
})

test('Should merge a tail that only corrects the cached bars slightly', async () => {
  const corrected = history([bar('2026-11-19', 10.05), bar('2026-11-20', 11.5), bar('2026-11-23', 12)])
  const { cache, calls, advance } = await makeCache([full, corrected])
  await cache.get('AAPL')
  advance(61_000)
  const refreshed = await cache.get('AAPL')
  expect(calls).toHaveLength(2)
  expect(refreshed.bars).toEqual(corrected.bars)
})

test('Should download everything again twelve hours after the last full download even when it kept refreshing', async () => {
  const { cache, calls, advance } = await makeCache([full, tail, full])
  await cache.get('AAPL')
  advance(7 * HOUR)
  await cache.get('AAPL')
  advance(6 * HOUR)
  await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, '2026-11-10', undefined])
})

test('Should count the twelve hours again from each full download', async () => {
  const { cache, calls, advance } = await makeCache([full, full, tail])
  await cache.get('AAPL')
  advance(13 * HOUR)
  await cache.get('AAPL')
  advance(HOUR)
  await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, undefined, '2026-11-10'])
})

test('Should remember after a restart when the last full download was', async () => {
  const first = await makeCache([full, tail, full])
  await first.cache.get('AAPL')
  first.advance(11 * HOUR)
  await first.cache.get('AAPL')
  first.advance(2 * HOUR)
  const restarted = createHistoryCache({ provider: first.provider, dir: first.dir, now: first.now })
  await restarted.get('AAPL')
  expect(first.calls.map((call) => call.fromDate)).toEqual([undefined, '2026-11-10', undefined])
})

test('Should not hand out when the last full download was', async () => {
  const { cache, dir } = await makeCache([full])
  const answered = await cache.get('AAPL')
  expect(Object.keys(answered).sort()).toEqual(['bars', 'fetchedAt', 'info', 'splits', 'stale'])
  const restarted = createHistoryCache({
    provider: { history: async () => full, search: async () => [], quotes: async () => [], logoUrl: async () => null },
    dir,
    now: () => new Date('2026-11-23T20:00:05Z'),
  })
  expect(Object.keys(await restarted.get('AAPL')).sort()).toEqual(['bars', 'fetchedAt', 'info', 'splits', 'stale'])
})

test('Should answer with the downloaded history even when it cannot be written to disk', async () => {
  const blocker = join(await mkdtemp(join(tmpdir(), 'doji-cache-')), 'ocupado')
  await writeFile(blocker, 'no es una carpeta')
  const { cache, calls, advance } = await makeCache([full, tail], { dir: join(blocker, 'cache') })
  const first = await cache.get('AAPL')
  expect(first.bars).toEqual(full.bars)
  expect(first.stale).toBe(false)
  advance(61_000)
  const second = await cache.get('AAPL')
  expect(second.bars).toHaveLength(3)
  expect(second.stale).toBe(false)
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, '2026-11-10'])
})

test('Should not download everything over and over while the tail keeps disagreeing', async () => {
  const rebased = history([bar('2026-11-19', 5), bar('2026-11-20', 5.5), bar('2026-11-23', 6)])
  const { cache, calls, advance } = await makeCache([full, rebased, full, rebased, full])
  await cache.get('AAPL')
  advance(61_000)
  await cache.get('AAPL')
  advance(16_000)
  const third = await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate)).toEqual([undefined, '2026-11-10', undefined, '2026-11-10'])
  expect(third.stale).toBe(false)
  advance(11 * MINUTE)
  await cache.get('AAPL')
  expect(calls.map((call) => call.fromDate).slice(4)).toEqual(['2026-11-13', undefined])
})

test('Should hand over the copy it keeps without asking the source again', async () => {
  const { cache, calls, advance } = await makeCache([full, tail])
  await cache.get('AAPL')
  advance(3 * HOUR)
  const kept = await cache.peek('aapl')
  expect(kept.bars).toEqual(full.bars)
  expect(kept.stale).toBe(false)
  expect(calls).toHaveLength(1)
})

test('Should hand over the copy on disk in a new process without asking the source', async () => {
  const first = await makeCache([full])
  await first.cache.get('AAPL')
  const second = await makeCache([tail], { dir: first.dir })
  const kept = await second.cache.peek('AAPL')
  expect(kept.bars).toEqual(full.bars)
  expect(second.calls).toEqual([])
})

test('Should download a history it is asked to hand over but does not keep', async () => {
  const { cache, calls } = await makeCache([full])
  const kept = await cache.peek('AAPL')
  expect(kept.bars).toEqual(full.bars)
  expect(calls).toEqual([{ symbol: 'AAPL', fromDate: undefined }])
})
