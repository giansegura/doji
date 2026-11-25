import { expect, test } from 'vitest'
import type { NewsItem } from '../shared/types'
import { createNewsCache } from './newsCache'

const NOW = Date.parse('2026-11-25T15:00:00Z')

const headline = (id: string): NewsItem => ({ id, title: `Title ${id}`, publisher: 'Reuters', time: NOW, url: `https://example.com/${id}` })

test('Should ask for the headlines of a symbol at most every fifteen minutes', async () => {
  const asked: string[] = []
  let clock = NOW
  const cache = createNewsCache({
    fetchNews: async (symbol) => {
      asked.push(symbol)
      return [headline(`${symbol}-${asked.length}`)]
    },
    now: () => new Date(clock),
  })
  expect((await cache.get('aapl'))[0].id).toBe('AAPL-1')
  clock += 14 * 60_000
  expect((await cache.get('AAPL'))[0].id).toBe('AAPL-1')
  clock += 2 * 60_000
  expect((await cache.get('AAPL'))[0].id).toBe('AAPL-2')
  expect(asked).toEqual(['AAPL', 'AAPL'])
})

test('Should keep the headlines it had when the source fails, and fail when it has none', async () => {
  let failing = false
  let clock = NOW
  const cache = createNewsCache({
    fetchNews: async () => {
      if (failing) throw new Error('unavailable')
      return [headline('a')]
    },
    now: () => new Date(clock),
  })
  await cache.get('AAPL')
  failing = true
  clock += 20 * 60_000
  expect(await cache.get('AAPL')).toEqual([headline('a')])
  await expect(cache.get('MSFT')).rejects.toThrow('unavailable')
})
