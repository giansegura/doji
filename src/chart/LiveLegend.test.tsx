import { act, render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { expect, test } from 'vitest'
import { type Bar, DEFAULT_STATE } from '../../shared/types'
import { themes } from '../theme/tokens'
import { LiveLegend } from './LiveLegend'
import { type HoverStore, createHoverStore } from './hoverStore'
import { type SeriesData, buildSeriesData } from './seriesData'

const info = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }
const colors = { volumeUp: 'up', volumeDown: 'down' }

const bar = (time: string, close: number): Bar => ({ time, open: close, high: close, low: close, close, volume: 1000 })

const dataOf = (closes: number[]): SeriesData =>
  buildSeriesData(
    closes.map((close, index) => bar(`2026-11-${String(16 + index).padStart(2, '0')}`, close)),
    'D',
    14,
    colors,
  )

const text = (): string => document.body.textContent ?? ''

const counter = { renders: 0 }

const Host = ({ hover, data }: { hover: HoverStore; data: SeriesData }) => {
  counter.renders += 1
  return (
    <ThemeProvider theme={themes.dark}>
      <LiveLegend
        hover={hover}
        data={data}
        info={info}
        timeframe="D"
        indicators={DEFAULT_STATE.indicators}
        rsiPaneTop={null}
      />
    </ThemeProvider>
  )
}

const setup = (closes: number[]) => {
  const hover = createHoverStore()
  counter.renders = 0
  const view = render(<Host hover={hover} data={dataOf(closes)} />)
  return { hover, rerender: (next: number[]) => view.rerender(<Host hover={hover} data={dataOf(next)} />) }
}

test('Should show the last bar while nothing is hovered', () => {
  setup([101.11, 102.22, 103.33])
  expect(text()).toContain('C103.33')
})

test('Should show the hovered bar', () => {
  const { hover } = setup([101.11, 102.22, 103.33])
  act(() => hover.set(0))
  expect(text()).toContain('C101.11')
})

test('Should show the last bar when the cursor is past the bars', () => {
  const { hover } = setup([101.11, 102.22, 103.33])
  act(() => hover.set(9))
  expect(text()).toContain('C103.33')
})

test('Should show the fresh values of the hovered bar when the data changes', () => {
  const { hover, rerender } = setup([101.11, 102.22, 103.33])
  act(() => hover.set(2))
  rerender([101.11, 102.22, 104.44])
  expect(text()).toContain('C104.44')
})

test('Should follow the cursor without rendering what is around it', () => {
  const { hover } = setup([101.11, 102.22, 103.33])
  const before = counter.renders
  act(() => hover.set(0))
  act(() => hover.set(1))
  expect(text()).toContain('C102.22')
  expect(counter.renders).toBe(before)
})
