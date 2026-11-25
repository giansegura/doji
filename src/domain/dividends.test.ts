import { expect, test } from 'vitest'
import { dividendLabel, dividendOfBar } from './dividends'

const dividends = [
  { date: '2026-08-11', amount: 0.26 },
  { date: '2026-11-07', amount: 0.1925 },
]

test('Should find the dividend paid on the bar under the cursor, and none on the others', () => {
  const daily = [{ time: '2026-08-10' }, { time: '2026-08-11' }, { time: '2026-08-12' }]
  expect(dividendOfBar(dividends, daily, 1, 'D')).toEqual({ date: '2026-08-11', amount: 0.26 })
  expect(dividendOfBar(dividends, daily, 0, 'D')).toBeNull()
  expect(dividendOfBar(dividends, daily, 2, 'D')).toBeNull()
  expect(dividendOfBar(dividends, daily, 9, 'D')).toBeNull()
})

test('Should find the dividend paid within the week or the month of the bar', () => {
  const weekly = [{ time: '2026-11-03' }, { time: '2026-11-09' }]
  expect(dividendOfBar(dividends, weekly, 0, 'W')).toEqual({ date: '2026-11-07', amount: 0.1925 })
  expect(dividendOfBar(dividends, weekly, 1, 'W')).toBeNull()
  const monthly = [{ time: '2026-08-03' }, { time: '2026-09-01' }]
  expect(dividendOfBar(dividends, monthly, 0, 'M')).toEqual({ date: '2026-08-11', amount: 0.26 })
})

test('Should write the amount with two decimals at least and four at most', () => {
  expect(dividendLabel({ date: '2026-08-11', amount: 0.26 })).toBe('Dividend 0.26')
  expect(dividendLabel({ date: '2026-08-11', amount: 0.1925 })).toBe('Dividend 0.1925')
  expect(dividendLabel({ date: '2026-08-11', amount: 1 })).toBe('Dividend 1.00')
  expect(dividendLabel({ date: '2026-08-11', amount: 0.123456 })).toBe('Dividend 0.1235')
})
