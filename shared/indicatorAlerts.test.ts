import { expect, test } from 'vitest'
import { createIndicatorWatcher, indicatorLabel, sessionDayOf, tradesOnWeekends, withLivePrice } from './indicatorAlerts'
import type { IndicatorAlert, SmaConfig } from './types'

const falling = Array.from({ length: 40 }, (_, index) => 100 - index * 0.5 + (index % 2 === 0 ? 0.3 : -0.3))
const averages: SmaConfig[] = [{ id: 's50', length: 5, color: '#fff', width: 1 }]

const rsiAlert: IndicatorAlert = { id: 'r', kind: 'rsi', value: 30, armed: true }
const averageAlert: IndicatorAlert = { id: 'a', kind: 'average', value: 0, averageId: 's50', armed: true }
const moveAlert: IndicatorAlert = { id: 'm', kind: 'move', value: 3, armed: true }

test('Should put the live price on the bar of today, or start that bar when the history ends the day before', () => {
  expect(withLivePrice([10, 11, 12], '2026-11-24', 13, '2026-11-24')).toEqual({ closes: [10, 11, 13], previous: 11 })
  expect(withLivePrice([10, 11, 12], '2026-11-23', 13, '2026-11-24')).toEqual({ closes: [10, 11, 12, 13], previous: 12 })
})

test('Should fire when the RSI crosses its level, once, and say which way', () => {
  const watcher = createIndicatorWatcher()
  const day = '2026-11-24'
  expect(watcher.check('KO', [rsiAlert], { closes: [...falling.slice(0, -1), 90], previous: falling.at(-2) as number }, averages, day)).toEqual([])
  const hits = watcher.check('KO', [rsiAlert], { closes: [...falling.slice(0, -1), 70], previous: falling.at(-2) as number }, averages, day)
  expect(hits).toEqual([expect.objectContaining({ alertId: 'r', direction: 'down', level: 30 })])
})

test('Should fire when the price crosses one of the averages and skip an average that no longer exists', () => {
  const watcher = createIndicatorWatcher()
  const base = [10, 10, 10, 10, 10]
  watcher.check('KO', [averageAlert], { closes: [...base, 9.5], previous: 10 }, averages, '2026-11-24')
  const hits = watcher.check('KO', [averageAlert], { closes: [...base, 11], previous: 10 }, averages, '2026-11-24')
  expect(hits).toEqual([expect.objectContaining({ alertId: 'a', direction: 'up' })])
  expect(watcher.check('KO', [{ ...averageAlert, averageId: 'gone' }], { closes: [...base, 9], previous: 10 }, averages, '2026-11-24')).toEqual([])
})

test('Should fire when the day moves more than its percent, up or down', () => {
  const watcher = createIndicatorWatcher()
  watcher.check('KO', [moveAlert], { closes: [100, 101], previous: 100 }, averages, '2026-11-24')
  expect(watcher.check('KO', [moveAlert], { closes: [100, 96.5], previous: 100 }, averages, '2026-11-24')).toEqual([
    expect.objectContaining({ alertId: 'm', direction: 'down', level: 3 }),
  ])
})

test('Should not fire alerts that are not armed', () => {
  const watcher = createIndicatorWatcher()
  watcher.check('KO', [{ ...moveAlert, armed: false }], { closes: [100, 101], previous: 100 }, averages, '2026-11-24')
  expect(watcher.check('KO', [{ ...moveAlert, armed: false }], { closes: [100, 90], previous: 100 }, averages, '2026-11-24')).toEqual([])
})

test('Should describe each alert in words', () => {
  expect(indicatorLabel(rsiAlert, averages)).toBe('RSI 14 crosses 30')
  expect(indicatorLabel(averageAlert, averages)).toBe('Price crosses SMA 5')
  expect(indicatorLabel(moveAlert, averages)).toBe('Day move beyond 3%')
  expect(indicatorLabel({ ...averageAlert, averageId: 'gone' }, averages)).toBe('Price crosses a removed average')
})

test('Should fire a day move already beyond its percent on the first price of the day', () => {
  const watcher = createIndicatorWatcher()
  expect(watcher.check('KO', [moveAlert], { closes: [100, 104], previous: 100 }, averages, '2026-11-24')).toEqual([
    expect.objectContaining({ alertId: 'm', direction: 'up' }),
  ])
  expect(watcher.check('KO', [rsiAlert], { closes: falling, previous: 100 }, averages, '2026-11-24')).toEqual([])
})

test('Should tell the session day of the exchange so the live price starts a new bar only on a new trading day', () => {
  const tuesday1430NewYork = Date.parse('2026-11-24T19:30:00Z')
  const wednesday0600NewYork = Date.parse('2026-11-25T11:00:00Z')
  const saturday = Date.parse('2026-11-28T15:00:00Z')
  expect(sessionDayOf('2026-11-24', 'America/New_York', tuesday1430NewYork, false)).toBe('2026-11-24')
  expect(sessionDayOf('2026-11-24', 'America/New_York', wednesday0600NewYork, false)).toBe('2026-11-25')
  expect(sessionDayOf('2026-11-27', 'America/New_York', saturday, false)).toBe('2026-11-27')
  expect(sessionDayOf('2026-11-27', 'UTC', saturday, true)).toBe('2026-11-28')
  expect(sessionDayOf('2026-11-24', undefined, wednesday0600NewYork, false)).toBe('2026-11-24')
})

test('Should tell a market trades on weekends when its daily bars include a Saturday or a Sunday', () => {
  expect(tradesOnWeekends(['2026-11-20', '2026-11-21', '2026-11-23'])).toBe(true)
  expect(tradesOnWeekends(['2026-11-20', '2026-11-23'])).toBe(false)
})
