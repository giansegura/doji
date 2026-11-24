import { expect, test } from 'vitest'
import { formatPercent, formatPrice, formatSigned, formatVolume } from './format'

test('Should format prices with two decimals and thousands separators', () => {
  expect(formatPrice(350.2900085)).toBe('350.29')
  expect(formatPrice(12345.5)).toBe('12,345.50')
  expect(formatPrice(0)).toBe('0.00')
})

test('Should keep four decimals for prices under one', () => {
  expect(formatPrice(0.1234567)).toBe('0.1235')
})

test('Should format changes with an explicit sign', () => {
  expect(formatSigned(2.7)).toBe('+2.70')
  expect(formatSigned(-1.5)).toBe('−1.50')
  expect(formatSigned(0)).toBe('0.00')
})

test('Should format percentages with an explicit sign', () => {
  expect(formatPercent(1.19)).toBe('+1.19%')
  expect(formatPercent(-0.4)).toBe('−0.40%')
  expect(formatPercent(0)).toBe('0.00%')
})

test('Should abbreviate volume', () => {
  expect(formatVolume(28_767_814)).toBe('28.77M')
  expect(formatVolume(1500)).toBe('1.5K')
  expect(formatVolume(999)).toBe('999')
  expect(formatVolume(2_500_000_000)).toBe('2.5B')
  expect(formatVolume(0)).toBe('0')
})
