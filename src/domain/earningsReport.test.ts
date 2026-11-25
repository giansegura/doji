import { expect, test } from 'vitest'
import type { Earnings } from '../../shared/types'
import { reportLabel, reportOfBar } from './earningsReport'

const earnings: Earnings = {
  past: ['2026-07-30', '2026-10-29'],
  next: '2027-01-28',
  nextIsEstimate: false,
  results: { '2026-07-30': { actual: 2.02, estimate: 1.89 }, '2026-10-29': { actual: 1.5, estimate: null } },
}

test('Should find the report of the bar under the cursor, in its day, week or month', () => {
  expect(reportOfBar(earnings, [{ time: '2026-07-29' }, { time: '2026-07-30' }], 1, 'D')).toEqual({ date: '2026-07-30', actual: 2.02, estimate: 1.89 })
  expect(reportOfBar(earnings, [{ time: '2026-07-29' }, { time: '2026-07-30' }], 0, 'D')).toBeNull()
  expect(reportOfBar(earnings, [{ time: '2026-07-27' }], 0, 'W')).toEqual({ date: '2026-07-30', actual: 2.02, estimate: 1.89 })
  expect(reportOfBar(null, [{ time: '2026-07-30' }], 0, 'D')).toBeNull()
})

test('Should say the actual and the expected earnings per share and the surprise', () => {
  expect(reportLabel({ date: '2026-07-30', actual: 2.02, estimate: 1.89 })).toBe('EPS 2.02 vs 1.89 est. (+6.88%)')
  expect(reportLabel({ date: '2026-10-29', actual: 1.5, estimate: null })).toBe('EPS 1.50')
  expect(reportLabel({ date: '2026-10-29', actual: -0.2, estimate: -0.25 })).toBe('EPS −0.20 vs −0.25 est. (+20.00%)')
})
