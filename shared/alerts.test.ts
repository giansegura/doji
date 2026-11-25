import { expect, test } from 'vitest'
import type { Drawing, HorizontalLine, Position, TrendLine } from './types'
import { alertLevel, alertLevels, armedSymbols, createAlertWatcher, latestPrice, sideChange } from './alerts'

const base = { id: 'a', pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 2, pricedAt: '2020-01-01' }

const level = (over: Partial<HorizontalLine> = {}): HorizontalLine => ({ ...base, kind: 'hline', value: 100, alert: true, ...over })

const trend = (over: Partial<TrendLine> = {}): TrendLine => ({
  ...base,
  p1: { date: '2026-11-02', value: 100 },
  p2: { date: '2026-11-16', value: 120 },
  extendRight: false,
  alert: true,
  ...over,
})

test('Should take the level of a horizontal line as it is', () => {
  expect(alertLevel(level({ value: 87.5 }), '2026-11-24')).toBe(87.5)
})

test('Should read a trend line at today by the trading days gone since it starts', () => {
  expect(alertLevel(trend(), '2026-11-09')).toBe(110)
  expect(alertLevel(trend(), '2026-11-02')).toBe(100)
  expect(alertLevel(trend(), '2026-11-16')).toBe(120)
})

test('Should read a trend line the same whichever end was drawn first', () => {
  const backwards = trend({ p1: { date: '2026-11-16', value: 120 }, p2: { date: '2026-11-02', value: 100 } })
  expect(alertLevel(backwards, '2026-11-09')).toBe(110)
})

test('Should follow a trend line beyond its end only when it extends to the right', () => {
  expect(alertLevel(trend(), '2026-11-23')).toBeNull()
  expect(alertLevel(trend({ extendRight: true }), '2026-11-23')).toBe(130)
})

test('Should give no level before a trend line starts, for a line with no length or for other drawings', () => {
  expect(alertLevel(trend(), '2026-10-30')).toBeNull()
  expect(alertLevel(trend({ p2: { date: '2026-11-02', value: 140 } }), '2026-11-02')).toBe(140)
  const box: Drawing = { ...base, kind: 'rect', p1: trend().p1, p2: trend().p2 }
  expect(alertLevel(box, '2026-11-09')).toBeNull()
})

test('Should tell when a price changes side of a level and in which direction', () => {
  expect(sideChange(-1, 1)).toBe('up')
  expect(sideChange(1, -1)).toBe('down')
  expect(sideChange(-1, 0)).toBe('up')
  expect(sideChange(1, 0)).toBe('down')
})

test('Should not count a price that stays on one side or starts on the level', () => {
  expect(sideChange(-2, -1)).toBeNull()
  expect(sideChange(2, 1)).toBeNull()
  expect(sideChange(0, 1)).toBeNull()
  expect(sideChange(0, 0)).toBeNull()
})

test('Should take the price outside regular hours when there is one', () => {
  expect(latestPrice({ symbol: 'KO', price: 60, change: 0, changePercent: 0 })).toBe(60)
  expect(latestPrice({ symbol: 'KO', price: 60, change: 0, changePercent: 0, extended: null })).toBe(60)
  const extended = { session: 'pre' as const, price: 61.5, changePercent: 2.5 }
  expect(latestPrice({ symbol: 'KO', price: 60, change: 0, changePercent: 0, extended })).toBe(61.5)
})

test('Should fire nothing the first time it sees a price', () => {
  const watcher = createAlertWatcher()
  expect(watcher.check({ KO: [level()] }, { KO: 101 }, '2026-11-24')).toEqual([])
})

test('Should fire when the price of a symbol crosses one of its armed drawings', () => {
  const watcher = createAlertWatcher()
  watcher.check({ KO: [level()] }, { KO: 99 }, '2026-11-24')
  expect(watcher.check({ KO: [level()] }, { KO: 100.4 }, '2026-11-24')).toEqual([
    { symbol: 'KO', drawingId: 'a', level: 100, price: 100.4, direction: 'up' },
  ])
})

test('Should not fire again while the price stays on the far side', () => {
  const watcher = createAlertWatcher()
  watcher.check({ KO: [level()] }, { KO: 99 }, '2026-11-24')
  watcher.check({ KO: [level()] }, { KO: 101 }, '2026-11-24')
  expect(watcher.check({ KO: [level()] }, { KO: 102 }, '2026-11-24')).toEqual([])
})

test('Should ignore drawings that are not armed, sit on the RSI pane or belong to a symbol without a price', () => {
  const watcher = createAlertWatcher()
  const lines = {
    KO: [level({ id: 'off', alert: false }), level({ id: 'rsi', pane: 'rsi' }), level({ id: 'plain', alert: undefined })],
    PEP: [level({ id: 'no-price' })],
  }
  watcher.check(lines, { KO: 99 }, '2026-11-24')
  expect(watcher.check(lines, { KO: 101 }, '2026-11-24')).toEqual([])
})

test('Should fire each armed drawing the price crosses in the same move', () => {
  const watcher = createAlertWatcher()
  const lines = { KO: [level({ id: 'low', value: 100 }), level({ id: 'high', value: 104 }), level({ id: 'far', value: 120 })] }
  watcher.check(lines, { KO: 99 }, '2026-11-24')
  expect(watcher.check(lines, { KO: 105 }, '2026-11-24').map((fired) => fired.drawingId)).toEqual(['low', 'high'])
})

test('Should keep the last price of a symbol that a later answer leaves out', () => {
  const watcher = createAlertWatcher()
  watcher.check({ KO: [level()] }, { KO: 99 }, '2026-11-24')
  watcher.check({ KO: [level()] }, {}, '2026-11-24')
  expect(watcher.check({ KO: [level()] }, { KO: 101 }, '2026-11-24')).toHaveLength(1)
})

test('Should list the symbols that have an armed drawing', () => {
  const watcher = createAlertWatcher()
  expect(watcher.symbols({ KO: [level()], PEP: [level({ alert: false })], MSFT: [trend()], NVDA: [] })).toEqual(['KO', 'MSFT'])
})

test('Should not fire when a price stays above a rising line from one day to the next', () => {
  const watcher = createAlertWatcher()
  const lines = { KO: [trend({ extendRight: true })] }
  watcher.check(lines, { KO: 111 }, '2026-11-09')
  expect(watcher.check(lines, { KO: 112.5 }, '2026-11-10')).toEqual([])
})

test('Should fire when a rising line climbs through a price that did not move', () => {
  const watcher = createAlertWatcher()
  const lines = { KO: [trend({ extendRight: true })] }
  watcher.check(lines, { KO: 111 }, '2026-11-09')
  expect(watcher.check(lines, { KO: 111 }, '2026-11-10')).toEqual([
    { symbol: 'KO', drawingId: 'a', level: 112, price: 111, direction: 'down' },
  ])
})

test('Should not fire for a line that was not there yet when the previous price was seen', () => {
  const watcher = createAlertWatcher()
  const lines = { KO: [trend()] }
  watcher.check(lines, { KO: 90 }, '2026-10-30')
  expect(watcher.check(lines, { KO: 105 }, '2026-11-02')).toEqual([])
})

const position = (over: Partial<Position> = {}): Position => ({
  ...base,
  kind: 'position',
  side: 'long',
  p1: { date: '2026-11-02', value: 100 },
  p2: { date: '2026-11-20', value: 100 },
  stop: 95,
  target: 110,
  alert: true,
  ...over,
})

test('Should fire an armed position when the price reaches its target or its stop, from its entry day on', () => {
  const watcher = createAlertWatcher()
  watcher.check({ KO: [position()] }, { KO: 105 }, '2026-11-24')
  expect(watcher.check({ KO: [position()] }, { KO: 111 }, '2026-11-24')).toEqual([
    { symbol: 'KO', drawingId: 'a', level: 110, price: 111, direction: 'up' },
  ])
  expect(watcher.check({ KO: [position()] }, { KO: 94 }, '2026-11-24')).toEqual([
    { symbol: 'KO', drawingId: 'a', level: 95, price: 94, direction: 'down' },
  ])
  const early = createAlertWatcher()
  early.check({ KO: [position({ p1: { date: '2026-12-01', value: 100 } })] }, { KO: 105 }, '2026-11-24')
  expect(early.check({ KO: [position({ p1: { date: '2026-12-01', value: 100 } })] }, { KO: 111 }, '2026-11-24')).toEqual([])
  expect(armedSymbols({ KO: [position()], PEP: [position({ alert: false })] })).toEqual(['KO'])
})

test('Should not watch a line drawn in euros, since prices arrive in the currency of the symbol', () => {
  expect(alertLevels(level({ currency: 'EUR' }), '2026-11-20')).toEqual([])
  expect(alertLevels(level(), '2026-11-20')).toEqual([100])
})
