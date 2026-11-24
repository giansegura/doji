import { expect, test } from 'vitest'
import type { Bar, Quote } from '../../shared/types'
import { tabTitle } from './tabTitle'

const bar = (time: string, close: number): Bar => ({ time, open: close, high: close, low: close, close, volume: 1 })

test('Should show the symbol, its price, an arrow up and the rise since the previous close', () => {
  expect(tabTitle('AMZN', null, [bar('2026-11-20', 246.82), bar('2026-11-23', 255.39)])).toBe('AMZN 255.39 ▲ +3.47%')
})

test('Should show an arrow down and the fall since the previous close', () => {
  expect(tabTitle('SXR8', null, [bar('2026-11-20', 718.69), bar('2026-11-23', 706.4)])).toBe('SXR8 706.40 ▼ −1.71%')
})

test('Should show no arrow when the price did not move', () => {
  expect(tabTitle('KO', null, [bar('2026-11-20', 60), bar('2026-11-23', 60)])).toBe('KO 60.00 0.00%')
})

test('Should show only the price when there is no previous close', () => {
  expect(tabTitle('KO', null, [bar('2026-11-23', 60)])).toBe('KO 60.00')
})

test('Should show only the symbol while its prices load', () => {
  expect(tabTitle('KO', null, [])).toBe('KO')
})

test('Should show a forex pair like TradingView with the decimals of forex', () => {
  expect(tabTitle('EURUSD=X', null, [bar('2026-11-20', 1.0906), bar('2026-11-23', 1.096731)])).toBe('EURUSD 1.0967 ▲ +0.56%')
})

test('Should take the price and the change of the quote the watchlist shows when there is one', () => {
  const quote: Quote = { symbol: 'EURUSD=X', price: 1.0967, change: 0.0061, changePercent: 0.5593, extended: null }
  expect(tabTitle('EURUSD=X', quote, [bar('2026-11-20', 1.0971), bar('2026-11-23', 1.0967)])).toBe('EURUSD 1.0967 ▲ +0.56%')
})
