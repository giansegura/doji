import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { DEFAULT_STATE, type Indicators } from '../../shared/types'
import { renderWithTheme } from '../test/render'
import { Legend } from './Legend'
import type { HoverValues } from './seriesData'

const info = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }

const values: HoverValues = {
  bar: { time: '2026-11-23', open: 347.78, high: 352.6, low: 345.44, close: 350.29, volume: 28_767_814 },
  previousClose: 342.56,
  rsi: 56.318,
  rsiMa: 48.1,
  smas: [],
}

const text = (): string => document.body.textContent ?? ''

const setup = (over: { values?: HoverValues | null; indicators?: Indicators; rsiPaneTop?: number | null; timeframe?: 'D' | 'W' } = {}) =>
  renderWithTheme(
    <Legend
      info={info}
      timeframe={over.timeframe ?? 'D'}
      values={over.values === undefined ? values : over.values}
      indicators={over.indicators ?? DEFAULT_STATE.indicators}
      rsiPaneTop={over.rsiPaneTop === undefined ? 500 : over.rsiPaneTop}
    />,
  )

test('Should show name, timeframe and exchange', () => {
  setup()
  expect(screen.getByText('Apple Inc. · 1D · NASDAQ')).toBeTruthy()
})

test('Should show the logo of the company before its name', () => {
  setup()
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/api/logo?symbol=AAPL')
})

test('Should name the weekly timeframe', () => {
  setup({ timeframe: 'W' })
  expect(screen.getByText('Apple Inc. · 1W · NASDAQ')).toBeTruthy()
})

test('Should show OHLC and the change against the previous close', () => {
  setup()
  expect(['347.78', '352.60', '345.44', '350.29'].map((value) => screen.getAllByText(value).length)).toEqual([1, 1, 1, 1])
  expect(screen.getByText('+7.73 (+2.26%)')).toBeTruthy()
})

test('Should measure the change against the open when there is no previous bar', () => {
  setup({ values: { ...values, bar: { ...values.bar, open: 10, close: 9 }, previousClose: null } })
  expect(screen.getByText('−1.00 (−10.00%)')).toBeTruthy()
})

test('Should show the volume only while the indicator is on', () => {
  setup()
  expect(screen.getByText('28.77M')).toBeTruthy()
  const hidden = { ...DEFAULT_STATE.indicators, volume: { visible: false } }
  setup({ indicators: hidden })
  expect(screen.getAllByText('28.77M')).toHaveLength(1)
})

test('Should show the RSI and its average over the RSI pane', () => {
  setup()
  expect(screen.getByText('RSI 14 close')).toBeTruthy()
  expect(screen.getByText('56.32')).toBeTruthy()
  expect(screen.getByText('48.10')).toBeTruthy()
})

test('Should hide the average when it is switched off', () => {
  setup({ indicators: { ...DEFAULT_STATE.indicators, rsi: { visible: true, length: 21, showMa: false } } })
  expect(screen.getByText('RSI 21 close')).toBeTruthy()
  expect(screen.queryByText('48.10')).toBeNull()
})

test('Should hide the RSI legend without an RSI pane', () => {
  setup({ rsiPaneTop: null })
  expect(text()).not.toContain('RSI')
  setup({ indicators: { ...DEFAULT_STATE.indicators, rsi: { visible: false, length: 14, showMa: true } } })
  expect(text()).not.toContain('RSI')
})

test('Should leave out RSI values during the warm-up', () => {
  setup({ values: { ...values, rsi: null, rsiMa: null } })
  expect(screen.getByText('RSI 14 close')).toBeTruthy()
  expect(screen.queryByText('56.32')).toBeNull()
})

test('Should show each moving average with its period and value', () => {
  const sma = [
    { id: 'a', length: 20, color: '#FF9800', width: 1 },
    { id: 'b', length: 50, color: '#2962FF', width: 2 },
  ]
  setup({ values: { ...values, smas: [345.123, null] }, indicators: { ...DEFAULT_STATE.indicators, sma } })
  expect(screen.getByText('SMA 20 close')).toBeTruthy()
  expect(screen.getByText('345.12')).toBeTruthy()
  expect(screen.getByText('SMA 50 close')).toBeTruthy()
})

test('Should not mention moving averages when there are none', () => {
  setup()
  expect(text()).not.toContain('SMA')
})

test('Should show only the title when there are no values', () => {
  setup({ values: null })
  expect(screen.getByText('Apple Inc. · 1D · NASDAQ')).toBeTruthy()
  expect(text()).not.toContain('Vol')
})
