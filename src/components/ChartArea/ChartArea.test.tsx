import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { expect, test, vi } from 'vitest'
import { DEFAULT_STATE, type History, type TrendLine } from '../../../shared/types'
import type { Tool } from '../../state/appReducer'
import { themes } from '../../theme/tokens'
import { ChartArea } from '.'

vi.mock('../../chart/ChartView', () => ({
  ChartView: ({ history, lines, tool }: { history: History; lines: TrendLine[]; tool: Tool }) => (
    <div>{`gráfico de ${history.info.symbol} · ${lines.length} líneas · ${tool}`}</div>
  ),
}))

const historyOf = (symbol: string, bars = 1): History => ({
  info: { symbol, name: `${symbol} Inc.`, exchange: 'NASDAQ' },
  bars: Array.from({ length: bars }, () => ({ time: '2026-11-23', open: 1, high: 2, low: 1, close: 2, volume: 3 })),
  splits: [],
  fetchedAt: '2026-11-23T20:00:00.000Z',
  stale: false,
})

const line: TrendLine = {
  id: 'a',
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2026-11-02', value: 1 },
  p2: { date: '2026-11-20', value: 2 },
  color: '#2962FF',
  width: 2,
  extendRight: false,
  pricedAt: '0000-01-01',
}

type Props = {
  symbol?: string
  status?: 'loading' | 'ready' | 'error'
  history?: History | null
  errorCode?: string | null
  tool?: Tool
}

const setup = (initial: Props = {}) => {
  const onRetry = vi.fn()
  const onLinesChange = vi.fn()
  const ui = (props: Props) => (
    <ThemeProvider theme={themes.midnight}>
      <ChartArea
        symbol={props.symbol ?? 'AAPL'}
        status={props.status ?? 'ready'}
        history={props.history === undefined ? historyOf('AAPL') : props.history}
        errorCode={props.errorCode ?? null}
        timeframe="D"
        indicators={DEFAULT_STATE.indicators}
        settings={DEFAULT_STATE.chart}
        lines={[line]}
        tool={props.tool ?? 'trendline'}
        onLinesChange={onLinesChange}
        looks={{}}
        onLook={() => undefined}
        onToolDone={() => undefined}
        onRetry={onRetry}
      />
    </ThemeProvider>
  )
  const view = render(ui(initial))
  return { onRetry, onLinesChange, update: (props: Props) => view.rerender(ui(props)) }
}

test('Should say it is loading when there is nothing to show yet', () => {
  setup({ status: 'loading', history: null })
  expect(screen.getByText('Loading…')).toBeTruthy()
})

test('Should say when a symbol has no data', () => {
  setup({ status: 'error', history: null, errorCode: 'not_found', symbol: 'NOEXISTE' })
  expect(screen.getByText('No data for NOEXISTE')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
})

test('Should say when a symbol exists but has no bars', () => {
  setup({ history: historyOf('AAPL', 0) })
  expect(screen.getByText('No data for AAPL')).toBeTruthy()
})

test('Should offer to retry when the data could not be loaded', async () => {
  const { onRetry } = setup({ status: 'error', history: null, errorCode: 'unavailable' })
  expect(screen.getByText('Could not load the data')).toBeTruthy()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('Should show the chart with its lines and tool once there is data', () => {
  setup()
  expect(screen.getByText('gráfico de AAPL · 1 líneas · trendline')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
})

test('Should keep the previous chart on screen, without its lines or tools, while the next symbol loads', () => {
  const { update } = setup()
  update({ symbol: 'MSFT', status: 'loading', history: null })
  expect(screen.getByText('gráfico de AAPL · 0 líneas · cursor')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('Loading MSFT…')
})

test('Should switch to the new chart when its data arrives', () => {
  const { update } = setup()
  update({ symbol: 'MSFT', status: 'loading', history: null })
  update({ symbol: 'MSFT', status: 'ready', history: historyOf('MSFT') })
  expect(screen.getByText('gráfico de MSFT · 1 líneas · trendline')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
})

test('Should drop the previous chart when the next symbol fails', () => {
  const { update } = setup()
  update({ symbol: 'NOEXISTE', status: 'loading', history: null })
  update({ symbol: 'NOEXISTE', status: 'error', history: null, errorCode: 'not_found' })
  expect(screen.getByText('No data for NOEXISTE')).toBeTruthy()
  expect(screen.queryByText(/gráfico de/)).toBeNull()
})
