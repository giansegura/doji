import { expect, test } from 'vitest'
import { columnCell } from './watchColumns'

const metrics = {
  rsi: 56.734,
  fromHighPercent: -3.2,
  volumeRatio: 1.437,
  level: { price: 245, kind: 'resistance' as const, percent: 2.1 },
}

test('Should write each column of a symbol short enough to fit', () => {
  expect(columnCell('rsi', 'KO', metrics, undefined)).toEqual({ text: '56.7' })
  expect(columnCell('fromHigh', 'KO', metrics, undefined)).toEqual({ text: '−3.20%', title: '3.20% below the high of the last 52 weeks' })
  expect(columnCell('relVolume', 'KO', metrics, undefined)).toEqual({ text: '1.4×', title: 'Volume 1.44 times its 20-day average' })
  expect(columnCell('level', 'KO', metrics, undefined)).toEqual({ text: '+2.10%', title: 'Nearest resistance at 245.00' })
})

test('Should write the next earnings as a day, marked when it is only an estimate', () => {
  expect(columnCell('earnings', 'KO', undefined, { past: [], next: '2027-01-28', nextIsEstimate: false })).toEqual({
    text: 'Jan 28',
    title: 'Earnings Jan 28, 2027',
  })
  expect(columnCell('earnings', 'KO', undefined, { past: [], next: '2027-01-28', nextIsEstimate: true })).toEqual({
    text: '~Jan 28',
    title: 'Earnings ~Jan 28, 2027',
  })
})

test('Should write a dash for what it does not know yet', () => {
  expect(columnCell('rsi', 'KO', undefined, undefined)).toEqual({ text: '—' })
  expect(columnCell('level', 'KO', { ...metrics, level: null }, undefined)).toEqual({ text: '—' })
  expect(columnCell('earnings', 'KO', undefined, { past: [], next: null, nextIsEstimate: false })).toEqual({ text: '—' })
})
