import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { DEFAULT_STATE, type Indicators, type SymbolInfo } from '../../shared/types'
import { renderWithTheme } from '../test/render'
import { Legend } from './Legend'
import type { HoverValues } from './seriesData'

const info = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }

const values: HoverValues = {
  bar: { time: '2026-11-23', open: 347.78, high: 352.6, low: 345.44, close: 350.29, volume: 28_767_814 },
  previousClose: 342.56,
  volumeMa: null,
  rsi: 56.318,
  rsiMa: 48.1,
  smas: [],
  bands: null,
  macd: null,
}

const text = (): string => document.body.textContent ?? ''

type Options = {
  values?: HoverValues | null
  indicators?: Indicators
  rsiPaneTop?: number | null
  macdPaneTop?: number | null
  timeframe?: 'D' | 'W'
  info?: SymbolInfo
  earnings?: string | null
  dividend?: string | null
  inEuros?: boolean
}

const setup = (over: Options = {}) =>
  renderWithTheme(
    <Legend
      info={over.info ?? info}
      timeframe={over.timeframe ?? 'D'}
      values={over.values === undefined ? values : over.values}
      indicators={over.indicators ?? DEFAULT_STATE.indicators}
      rsiPaneTop={over.rsiPaneTop === undefined ? 500 : over.rsiPaneTop}
      macdPaneTop={over.macdPaneTop ?? null}
      earnings={over.earnings ?? null}
      dividend={over.dividend ?? null}
      inEuros={over.inEuros ?? false}
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

test('Should name an exponential moving average as such', () => {
  const indicators = { ...DEFAULT_STATE.indicators, sma: [{ id: 'a', length: 21, color: '#FF9800', width: 1, kind: 'ema' as const }] }
  setup({ indicators, values: { ...values, smas: [348.2] } })
  expect(text()).toContain('EMA 21 close')
  expect(text()).not.toContain('SMA 21')
})

test('Should show the average of the volume next to the volume while it is on', () => {
  const indicators = { ...DEFAULT_STATE.indicators, volumeMa: { visible: true, length: 20 } }
  setup({ indicators, values: { ...values, volumeMa: 31_500_000 } })
  expect(text()).toContain('31.5M')
})

test('Should not show the average of the volume while it is off', () => {
  setup({ values: { ...values, volumeMa: 31_500_000 } })
  expect(text()).not.toContain('31.5M')
})

test('Should show the three values of the Bollinger Bands with their settings', () => {
  const indicators = { ...DEFAULT_STATE.indicators, bollinger: { visible: true, length: 20, multiplier: 2 } }
  setup({ indicators, values: { ...values, bands: { basis: 340.5, upper: 355.25, lower: 325.75 } } })
  expect(text()).toContain('BB 20 2')
  expect(text()).toContain('340.50')
  expect(text()).toContain('355.25')
  expect(text()).toContain('325.75')
})

test('Should not mention the Bollinger Bands while they are off', () => {
  setup({ values: { ...values, bands: { basis: 340.5, upper: 355.25, lower: 325.75 } } })
  expect(text()).not.toContain('BB 20')
})

test('Should show the MACD, its signal and its histogram over the MACD pane', () => {
  const indicators = { ...DEFAULT_STATE.indicators, macd: { visible: true, fast: 12, slow: 26, signal: 9 } }
  setup({ indicators, macdPaneTop: 600, values: { ...values, macd: { line: 1.234, signal: 0.9, histogram: 0.334 } } })
  expect(text()).toContain('MACD 12 26 9')
  expect(text()).toContain('1.23')
  expect(text()).toContain('0.90')
  expect(text()).toContain('0.33')
})

test('Should hide the MACD legend without a MACD pane', () => {
  const indicators = { ...DEFAULT_STATE.indicators, macd: { visible: true, fast: 12, slow: 26, signal: 9 } }
  setup({ indicators, macdPaneTop: null, values: { ...values, macd: { line: 1.234, signal: 0.9, histogram: 0.334 } } })
  expect(text()).not.toContain('MACD')
})

test('Should show the prices of a forex pair with the decimals of forex', () => {
  renderWithTheme(
    <Legend
      info={{ symbol: 'EURUSD=X', name: 'EUR/USD', exchange: 'Forex' }}
      timeframe="D"
      values={{ ...values, bar: { time: '2026-11-23', open: 1.09039, high: 1.09673, low: 1.08991, close: 1.096731, volume: 0 }, previousClose: 1.0906 }}
      indicators={DEFAULT_STATE.indicators}
      rsiPaneTop={null}
      macdPaneTop={null}
    />,
  )
  expect(text()).toContain('1.0967')
  expect(text()).toContain('1.0899')
})

test('Should show the change and the MACD of a forex pair with the decimals of forex', () => {
  const indicators = { ...DEFAULT_STATE.indicators, macd: { visible: true, fast: 12, slow: 26, signal: 9 } }
  setup({
    info: { symbol: 'EURUSD=X', name: 'EUR/USD', exchange: 'Forex' },
    indicators,
    macdPaneTop: 600,
    values: {
      ...values,
      bar: { time: '2026-11-23', open: 1.09, high: 1.095, low: 1.089, close: 1.094, volume: 0 },
      previousClose: 1.09,
      macd: { line: 0.0012, signal: 0.0008, histogram: 0.0004 },
    },
  })
  expect(text()).toContain('+0.0040 (+0.37%)')
  expect(text()).toContain('0.0012')
  expect(text()).toContain('0.0008')
  expect(text()).toContain('0.0004')
})

test('Should say when the next earnings come, and nothing without them', () => {
  const first = setup({ earnings: 'Earnings Jan 28, 2027' })
  expect(screen.getByText('Earnings Jan 28, 2027')).toBeTruthy()
  first.unmount()
  setup()
  expect(text()).not.toContain('Earnings')
})

test('Should show the dividend paid on the bar under the cursor', () => {
  const first = setup({ dividend: 'Dividend 0.26' })
  expect(screen.getByText('Dividend 0.26')).toBeTruthy()
  first.unmount()
  setup()
  expect(text()).not.toContain('Dividend')
})

test('Should say when the prices are shown in euros', () => {
  setup({ inEuros: true })
  expect(screen.getByText('Apple Inc. · 1D · NASDAQ · in EUR')).toBeTruthy()
})
