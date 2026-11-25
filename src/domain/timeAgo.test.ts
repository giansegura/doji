import { expect, test } from 'vitest'
import { timeAgo } from './timeAgo'

const NOW = Date.parse('2026-11-25T15:00:00Z')

test('Should say how long ago something happened, shorter the closer it is', () => {
  expect(timeAgo(NOW - 30_000, NOW)).toBe('just now')
  expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe('5m ago')
  expect(timeAgo(NOW - 3 * 3_600_000, NOW)).toBe('3h ago')
  expect(timeAgo(NOW - 2 * 86_400_000, NOW)).toBe('2d ago')
  expect(timeAgo(NOW - 10 * 86_400_000, NOW)).toBe('Nov 15')
})
