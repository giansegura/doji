import { expect, test } from 'vitest'
import { addDays } from '../../shared/dates'
import { addUsMarketDays, followsUsMarket, usMarketDaysBetween, usMarketHolidays } from './marketCalendar'

const isWeekend = (date: string): boolean => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())

const weekdaysFrom = (from: string, to: string): string[] => {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) if (!isWeekend(day)) days.push(day)
  return days
}

const sessionsFrom = (from: string, to: string): string[] => {
  const closed = new Set([2024, 2025, 2026, 2027].flatMap(usMarketHolidays))
  return weekdaysFrom(from, to).filter((day) => !closed.has(day))
}

test('Should list the market holidays of a regular year', () => {
  expect(usMarketHolidays(2026)).toEqual([
    '2026-01-01',
    '2026-01-19',
    '2026-02-16',
    '2026-04-03',
    '2026-05-25',
    '2026-06-19',
    '2026-07-03',
    '2026-09-07',
    '2026-11-26',
    '2026-12-25',
  ])
})

test('Should move weekend holidays to the nearest weekday', () => {
  expect(usMarketHolidays(2027)).toEqual([
    '2027-01-01',
    '2027-01-18',
    '2027-02-15',
    '2027-03-26',
    '2027-05-31',
    '2027-06-18',
    '2027-07-05',
    '2027-09-06',
    '2027-11-25',
    '2027-12-24',
  ])
})

test('Should not observe a New Year that falls on a Saturday', () => {
  expect(usMarketHolidays(2028)).toEqual([
    '2028-01-17',
    '2028-02-21',
    '2028-04-14',
    '2028-05-29',
    '2028-06-19',
    '2028-07-04',
    '2028-09-04',
    '2028-11-23',
    '2028-12-25',
  ])
})

test('Should observe on Monday a New Year that falls on a Sunday', () => {
  expect(usMarketHolidays(2023)[0]).toBe('2023-01-02')
})

test('Should not list Juneteenth before it became a market holiday', () => {
  expect(usMarketHolidays(2021)).not.toContain('2021-06-18')
  expect(usMarketHolidays(2022)).toContain('2022-06-20')
})

test('Should count sessions skipping weekends and holidays', () => {
  expect(usMarketDaysBetween('2026-11-23', '2026-11-25')).toBe(2)
  expect(usMarketDaysBetween('2026-11-23', '2026-11-27')).toBe(3)
  expect(usMarketDaysBetween('2026-11-23', '2026-11-30')).toBe(4)
  expect(usMarketDaysBetween('2026-12-23', '2027-01-04')).toBe(6)
})

test('Should give a holiday the count of the session before it', () => {
  expect(usMarketDaysBetween('2026-11-23', '2026-11-26')).toBe(2)
})

test('Should add sessions skipping weekends and holidays', () => {
  expect(addUsMarketDays('2026-11-23', 2)).toBe('2026-11-25')
  expect(addUsMarketDays('2026-11-23', 3)).toBe('2026-11-27')
  expect(addUsMarketDays('2026-12-23', 6)).toBe('2027-01-04')
  expect(addUsMarketDays('2026-11-23', 0)).toBe('2026-11-23')
})

test('Should add and count sessions consistently over two years', () => {
  const steps = Array.from({ length: 500 }, (_, index) => index + 1)
  const holidays = new Set([2026, 2027, 2028].flatMap(usMarketHolidays))
  const landed = steps.map((step) => addUsMarketDays('2026-11-23', step))
  expect(landed.map((date) => usMarketDaysBetween('2026-11-23', date))).toEqual(steps)
  expect(landed.filter((date) => holidays.has(date) || isWeekend(date))).toEqual([])
})

test('Should recognise a history that rests on the market holidays', () => {
  expect(followsUsMarket(sessionsFrom('2025-01-02', '2026-11-23'))).toBe(true)
})

test('Should not recognise a history that trades on a market holiday', () => {
  expect(followsUsMarket(weekdaysFrom('2025-01-02', '2026-11-23'))).toBe(false)
  expect(followsUsMarket([...sessionsFrom('2025-01-02', '2026-11-23'), '2026-09-07'].sort())).toBe(false)
})

test('Should not recognise a history too short to tell', () => {
  expect(followsUsMarket(sessionsFrom('2026-09-08', '2026-11-23'))).toBe(false)
  expect(followsUsMarket([])).toBe(false)
})

test('Should judge only by the recent holidays', () => {
  const old = weekdaysFrom('2024-01-02', '2025-06-30')
  expect(followsUsMarket([...old, ...sessionsFrom('2025-07-01', '2026-11-23')])).toBe(true)
})
