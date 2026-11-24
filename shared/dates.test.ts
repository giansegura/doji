import { expect, test } from 'vitest'
import { addDays, addWeekdays, mondayOf, weekdaysBetween, weeksBetween } from './dates'

test('Should return the Monday of the week', () => {
  expect(mondayOf('2026-11-25')).toBe('2026-11-23')
  expect(mondayOf('2026-11-29')).toBe('2026-11-23')
  expect(mondayOf('2026-11-23')).toBe('2026-11-23')
})

test('Should add calendar days across month and year boundaries', () => {
  expect(addDays('2026-11-20', -10)).toBe('2026-11-10')
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
})

test('Should add weekdays skipping weekends in both directions', () => {
  expect(addWeekdays('2026-11-20', 1)).toBe('2026-11-23')
  expect(addWeekdays('2026-11-20', 6)).toBe('2026-11-30')
  expect(addWeekdays('2026-11-23', -1)).toBe('2026-11-20')
  expect(addWeekdays('2026-11-21', 1)).toBe('2026-11-23')
  expect(addWeekdays('2026-11-20', 0)).toBe('2026-11-20')
})

test('Should count weekdays between dates with sign', () => {
  expect(weekdaysBetween('2026-11-20', '2026-11-30')).toBe(6)
  expect(weekdaysBetween('2026-11-23', '2026-11-20')).toBe(-1)
  expect(weekdaysBetween('2026-11-20', '2026-11-22')).toBe(0)
  expect(weekdaysBetween('2026-11-20', '2026-11-20')).toBe(0)
})

test('Should count weeks between the Mondays of two dates', () => {
  expect(weeksBetween('2026-11-20', '2026-12-01')).toBe(2)
  expect(weeksBetween('2026-12-31', '2027-01-04')).toBe(1)
  expect(weeksBetween('2026-11-23', '2026-11-18')).toBe(-1)
})
