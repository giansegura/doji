import { type RefObject, useEffect } from 'react'
import { useTheme } from 'styled-components'
import type { ChartSettings, Drawing, DrawingKind, History, Indicators, LineLook, Timeframe } from '../../shared/types'
import { changedLook, kindOf } from '../domain/lineLooks'
import type { LivePrice } from '../domain/liveBar'
import { splitBasis } from '../domain/splits'
import { askToNotify } from '../hooks/useAlerts'
import type { Tool } from '../state/appReducer'
import { LineToolbar } from './LineToolbar'
import { LiveLegend } from './LiveLegend'
import { imageName, saveChartImage } from './screenshot'
import * as Styles from './styles'
import { useAutoFit } from './useAutoFit'
import { useChart } from './useChart'
import { useDrawing } from './useDrawing'

type ChartViewProps = {
  history: History
  timeframe: Timeframe
  indicators: Indicators
  settings: ChartSettings
  live?: LivePrice | null
  viewId?: string
  screenshotRef?: RefObject<(() => void) | null>
  lines: Drawing[]
  tool: Tool
  onLinesChange: (lines: Drawing[]) => void
  looks?: Partial<Record<DrawingKind, LineLook>>
  onLook?: (kind: DrawingKind, look: LineLook) => void
  onToolDone: () => void
}

const NO_LOOKS: Partial<Record<DrawingKind, LineLook>> = {}

const formatFetchedAt = (fetchedAt: string): string =>
  new Date(fetchedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export const ChartView = ({
  history,
  timeframe,
  indicators,
  settings,
  live = null,
  viewId = 'main',
  screenshotRef,
  lines,
  tool,
  onLinesChange,
  looks = NO_LOOKS,
  onLook,
  onToolDone,
}: ChartViewProps) => {
  const theme = useTheme()
  const { containerRef, handles, data, rsiPaneTop, macdPaneTop, hover } = useChart({ history, timeframe, theme, indicators, settings, live, viewId })
  const { manual, release, fit } = useAutoFit(handles, history.info.symbol)
  const { selectedLine, updateLine, deleteSelected } = useDrawing({
    handles,
    symbol: history.info.symbol,
    lines,
    timeframe,
    rsiVisible: indicators.rsi.visible,
    tool,
    onToolDone,
    onLinesChange,
    onVerticalDrag: release,
    defaultColor: theme.chart.line,
    looks,
    measureColors: { up: theme.chart.up, down: theme.chart.down },
    handleFill: theme.chart.bg,
    priceBasis: splitBasis(history.splits),
  })
  const symbol = history.info.symbol

  const changeLine = (line: Drawing) => {
    const look = selectedLine ? changedLook(selectedLine, line) : null
    updateLine(line)
    if (look) onLook?.(kindOf(line), look)
  }

  useEffect(() => {
    if (!screenshotRef) return undefined
    screenshotRef.current = handles ? () => saveChartImage(handles.chart, imageName(symbol, timeframe, new Date())) : null
    return () => {
      screenshotRef.current = null
    }
  }, [screenshotRef, handles, symbol, timeframe])

  return (
    <Styles.Wrapper>
      <Styles.Canvas ref={containerRef} />
      <LiveLegend
        hover={hover}
        data={data}
        info={history.info}
        timeframe={timeframe}
        indicators={indicators}
        rsiPaneTop={rsiPaneTop}
        macdPaneTop={macdPaneTop}
      />
      {selectedLine && <LineToolbar line={selectedLine} onChange={changeLine} onDelete={deleteSelected} onArm={askToNotify} />}
      {manual && (
        <Styles.AutoFit type="button" title="Fit the price to the screen again" onClick={fit}>
          Auto
        </Styles.AutoFit>
      )}
      {history.stale && (
        <Styles.Notice role="status">Data from {formatFetchedAt(history.fetchedAt)}: no connection to the source</Styles.Notice>
      )}
    </Styles.Wrapper>
  )
}
