import { expect, test } from 'vitest'
import type { HorizontalLine } from './types'
import { afterFiring, expiredAlert, withoutAlert } from './drawings'

const line: HorizontalLine = {
  id: 'h',
  kind: 'hline',
  pane: 'price',
  timeframe: 'D',
  color: '#fff',
  width: 1,
  pricedAt: '2020-01-01',
  value: 60,
  alert: true,
}

test('Should forget every setting of an alert when it is disarmed', () => {
  const quiet = withoutAlert({ ...line, alertRepeat: true, alertUntil: '2026-12-31', alertFiredOn: '2026-11-25' })
  expect(['alert', 'alertRepeat', 'alertUntil', 'alertFiredOn'].filter((key) => key in quiet)).toEqual([])
})

test('Should disarm an alert that fires once and remember the day of one that repeats', () => {
  expect('alert' in afterFiring(line, '2026-11-25')).toBe(false)
  expect(afterFiring({ ...line, alertRepeat: true }, '2026-11-25')).toEqual({ ...line, alertRepeat: true, alertFiredOn: '2026-11-25' })
})

test('Should tell when an armed alert is past its last day', () => {
  expect(expiredAlert({ ...line, alertUntil: '2026-11-24' }, '2026-11-25')).toBe(true)
  expect(expiredAlert({ ...line, alertUntil: '2026-11-25' }, '2026-11-25')).toBe(false)
  expect(expiredAlert(line, '2026-11-25')).toBe(false)
  expect(expiredAlert({ ...line, alert: false, alertUntil: '2026-11-24' }, '2026-11-25')).toBe(false)
})
