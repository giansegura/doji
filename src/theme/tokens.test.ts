import { expect, test } from 'vitest'
import { THEME_OPTIONS, themes } from './tokens'

const TRADINGVIEW_BLUE = '#2962FF'

test('Should offer the doji theme first, then Midnight and Light', () => {
  expect(THEME_OPTIONS.map((option) => [option.name, option.label])).toEqual([
    ['doji', 'Doji'],
    ['midnight', 'Midnight'],
    ['light', 'Light'],
  ])
  THEME_OPTIONS.forEach((option) => expect(themes[option.name].name).toBe(option.name))
})

test('Should keep in Midnight the look doji had until now', () => {
  const { ui, chart } = themes.midnight
  expect([ui.panel, ui.separator, ui.gap, ui.popup, ui.accent, ui.up, ui.down]).toEqual([
    '#000000',
    '#222222',
    4,
    '#1E222D',
    TRADINGVIEW_BLUE,
    '#22AB94',
    '#F23645',
  ])
  expect([chart.bg, chart.up, chart.down, chart.line]).toEqual(['#131722', '#089981', '#F23645', TRADINGVIEW_BLUE])
})

test('Should give the doji theme its own accent, backgrounds and candles', () => {
  const doji = themes.doji
  const midnight = themes.midnight
  expect(doji.ui.accent).toBe('#7C5CFF')
  expect(doji.chart.line).toBe(doji.ui.accent)
  ;(['panel', 'bg', 'popup', 'separator', 'up', 'down'] as const).forEach((token) => expect(doji.ui[token]).not.toBe(midnight.ui[token]))
  ;(['bg', 'up', 'down', 'rsi'] as const).forEach((token) => expect(doji.chart[token]).not.toBe(midnight.chart[token]))
})

test('Should never use the TradingView blue in the doji theme', () => {
  const colours = [...Object.values(themes.doji.ui), ...Object.values(themes.doji.chart)].map(String)
  expect(colours.some((colour) => colour.toUpperCase().includes(TRADINGVIEW_BLUE.slice(1)))).toBe(false)
})

test('Should give every theme a veil that matches its chart', () => {
  expect(themes.doji.ui.veil).toBe('rgba(21, 20, 18, 0.6)')
  expect(themes.midnight.ui.veil).toBe('rgba(19, 23, 34, 0.6)')
  expect(themes.light.ui.veil).toBe('rgba(255, 255, 255, 0.6)')
})
