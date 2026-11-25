import { expect, test } from 'vitest'
import type { AlertEvent } from './types'
import { MAX_ALERT_HISTORY, toAlertHistory, withHistory } from './alertHistory'

const event = (id: string, at = '2026-11-25T15:00:00.000Z'): AlertEvent => ({
  id,
  symbol: 'KO',
  level: 60,
  price: 60.2,
  direction: 'up',
  at,
  text: null,
})

test('Should put the newest alerts first and keep only the most recent ones', () => {
  const old = Array.from({ length: MAX_ALERT_HISTORY }, (_, index) => event(`old-${index}`))
  const history = withHistory(old, [event('a'), event('b')])
  expect(history).toHaveLength(MAX_ALERT_HISTORY)
  expect(history.slice(0, 3).map((item) => item.id)).toEqual(['b', 'a', 'old-0'])
})

test('Should keep the saved alerts that are well formed, with their text and label', () => {
  const good = { ...event('a'), text: 'Breakout', label: 'RSI 14 crosses 30' }
  const saved = [good, { ...event('b'), direction: 'sideways' }, { ...event('c'), price: 'x' }, { ...event('d'), at: 'yesterday' }, null, 'x']
  expect(toAlertHistory(saved)).toEqual([good])
  expect(toAlertHistory(undefined)).toEqual([])
  expect(toAlertHistory(Array.from({ length: MAX_ALERT_HISTORY + 5 }, (_, index) => event(`e-${index}`)))).toHaveLength(MAX_ALERT_HISTORY)
})
