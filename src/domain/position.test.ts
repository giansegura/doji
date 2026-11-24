import { expect, test } from 'vitest'
import type { Position } from '../../shared/types'
import { positionReading } from './position'

const position = (over: Partial<Position> = {}): Position => ({
  id: 'p',
  pane: 'price',
  timeframe: 'D',
  color: '#2962FF',
  width: 1,
  pricedAt: '2020-01-01',
  kind: 'position',
  side: 'long',
  p1: { date: '2026-11-02', value: 100 },
  p2: { date: '2026-11-20', value: 100 },
  stop: 95,
  target: 115,
  ...over,
})

test('Should read the distance to the target and the stop of a long position and its reward to risk', () => {
  expect(positionReading(position())).toEqual({ targetPercent: 15, stopPercent: -5, rewardToRisk: 3, shares: null, risk: null })
})

test('Should read a short position the other way round', () => {
  expect(positionReading(position({ side: 'short', stop: 104, target: 92 }))).toEqual({
    targetPercent: -8,
    stopPercent: 4,
    rewardToRisk: 2,
    shares: null,
    risk: null,
  })
})

test('Should tell how many shares to buy for the account and the risk given, rounded down', () => {
  expect(positionReading(position({ account: 10000, riskPercent: 1 }))).toMatchObject({ shares: 20, risk: 100 })
  expect(positionReading(position({ account: 10000, riskPercent: 1, stop: 97 }))).toMatchObject({ shares: 33, risk: 100 })
})
