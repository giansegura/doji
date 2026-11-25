import { expect, test } from 'vitest'
import { addWeekdays } from '../shared/dates'
import { symbolMetrics } from '../shared/symbolMetrics'
import type { Bar, History } from '../shared/types'
import type { HistoryCache } from './historyCache'
import { createWatchMetrics } from './watchMetrics'

const NOW = Date.parse('2026-11-25T15:00:00Z')
const MINUTE = 60_000

const bars: Bar[] = Array.from({ length: 60 }, (_, index) => {
  const close = 100 + Math.sin(index / 3) * 5
  return { time: addWeekdays('2026-08-03', index), open: close, high: close + 1, low: close - 1, close, volume: 1000 + index }
})

const historyOf = (symbol: string, fetchedAt = new Date(NOW - MINUTE).toISOString()): History => ({
  info: { symbol, name: symbol, exchange: 'NYSE' },
  bars,
  splits: [],
  fetchedAt,
  stale: false,
})

const setup = (keptAt: Record<string, string | null>, failing: string[] = []) => {
  const kept = new Map(Object.entries(keptAt).flatMap(([symbol, at]) => (at ? [[symbol, historyOf(symbol, at)]] : [])))
  const downloads: string[] = []
  const reads: string[] = []
  let clock = NOW
  const history: HistoryCache = {
    get: async (symbol) => {
      downloads.push(symbol)
      if (failing.includes(symbol)) throw new Error('not_found')
      const fresh = historyOf(symbol, new Date(clock).toISOString())
      kept.set(symbol, fresh)
      return fresh
    },
    peek: async (symbol) => historyOf(symbol),
    kept: async (symbol) => {
      reads.push(symbol)
      return kept.get(symbol) ?? null
    },
  }
  const metrics = createWatchMetrics({ history, now: () => new Date(clock), workers: 2 })
  return {
    metrics,
    downloads,
    reads,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

test('Should answer at once with what it keeps and download the rest in the background', async () => {
  const { metrics, downloads } = setup({ KO: new Date(NOW - MINUTE).toISOString(), PEP: null })
  const first = await metrics.read(['KO', 'PEP'], false)
  expect(first.metrics).toEqual({ KO: symbolMetrics('KO', bars, false) })
  expect(first.pending).toBe(1)
  await metrics.settled()
  expect(downloads).toEqual(['PEP'])
  const second = await metrics.read(['KO', 'PEP'], false)
  expect(Object.keys(second.metrics)).toEqual(['KO', 'PEP'])
  expect(second.pending).toBe(0)
})

test('Should refresh in the background a history older than five minutes', async () => {
  const { metrics, downloads } = setup({ KO: new Date(NOW - 6 * MINUTE).toISOString() })
  const answer = await metrics.read(['KO'], false)
  expect(answer.metrics.KO).toBeDefined()
  expect(answer.pending).toBe(1)
  await metrics.settled()
  expect(downloads).toEqual(['KO'])
})

test('Should give the nearest level only when asked', async () => {
  const { metrics } = setup({ KO: new Date(NOW - MINUTE).toISOString() })
  expect((await metrics.read(['KO'], true)).metrics.KO).toEqual(symbolMetrics('KO', bars, true))
  expect((await metrics.read(['KO'], false)).metrics.KO.level).toBeNull()
})

test('Should not keep retrying a symbol that failed for five minutes', async () => {
  const { metrics, downloads, advance } = setup({ XXXX: null }, ['XXXX'])
  await metrics.read(['XXXX'], false)
  await metrics.settled()
  const again = await metrics.read(['XXXX'], false)
  expect(again).toEqual({ metrics: {}, pending: 0 })
  expect(downloads).toEqual(['XXXX'])
  advance(6 * MINUTE)
  await metrics.read(['XXXX'], false)
  await metrics.settled()
  expect(downloads).toEqual(['XXXX', 'XXXX'])
})

test('Should download no more than two histories at a time', async () => {
  let running = 0
  let most = 0
  const kept = new Map<string, History>()
  const history: HistoryCache = {
    get: async (symbol) => {
      running += 1
      most = Math.max(most, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      const fresh = historyOf(symbol, new Date(NOW).toISOString())
      kept.set(symbol, fresh)
      return fresh
    },
    peek: async (symbol) => historyOf(symbol),
    kept: async (symbol) => kept.get(symbol) ?? null,
  }
  const metrics = createWatchMetrics({ history, now: () => new Date(NOW), workers: 2 })
  await metrics.read(['A', 'B', 'C', 'D', 'E'], false)
  await metrics.settled()
  expect(most).toBe(2)
  expect(kept.size).toBe(5)
})

test('Should keep the values it worked out and not read the history again while they are fresh', async () => {
  const { metrics, reads, downloads } = setup({ KO: new Date(NOW - MINUTE).toISOString(), PEP: null })
  await metrics.read(['KO', 'PEP'], false)
  await metrics.settled()
  await metrics.read(['KO', 'PEP'], false)
  await metrics.read(['KO', 'PEP'], false)
  expect(reads).toEqual(['KO', 'PEP'])
  expect(downloads).toEqual(['PEP'])
})

test('Should refresh many symbols every half hour instead of every five minutes', async () => {
  const many = Array.from({ length: 80 }, (_, index) => `S${index}`)
  const { metrics, downloads, advance } = setup(Object.fromEntries(many.map((symbol) => [symbol, new Date(NOW - MINUTE).toISOString()])))
  await metrics.read(many, false)
  advance(10 * MINUTE)
  expect((await metrics.read(many, false)).pending).toBe(0)
  advance(25 * MINUTE)
  expect((await metrics.read(many, false)).pending).toBe(80)
  await metrics.settled()
  expect(downloads).toHaveLength(80)
})

test('Should not ask again and again for a history the source keeps failing to refresh', async () => {
  const kept = historyOf('KO', new Date(NOW - 10 * MINUTE).toISOString())
  let downloads = 0
  const history: HistoryCache = {
    get: async () => {
      downloads += 1
      return { ...kept, stale: true }
    },
    peek: async () => kept,
    kept: async () => kept,
  }
  const metrics = createWatchMetrics({ history, now: () => new Date(NOW), workers: 2 })
  expect((await metrics.read(['KO'], false)).pending).toBe(1)
  await metrics.settled()
  expect((await metrics.read(['KO'], false)).pending).toBe(0)
  expect(downloads).toBe(1)
})
