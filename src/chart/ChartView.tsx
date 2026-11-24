import { type RefObject, useEffect } from 'react'
import { useTheme } from 'styled-components'
import type { ChartSettings, History, Indicators, Timeframe, TrendLine } from '../../shared/types'
import { splitBasis } from '../domain/splits'
import type { Tool } from '../state/appReducer'
import { LineToolbar } from './LineToolbar'
import { LiveLegend } from './LiveLegend'
import { imageName, saveChartImage } from './screenshot'
import * as Styles from './styles'
import { useChart } from './useChart'
import { useDrawing } from './useDrawing'

type ChartViewProps = {
  history: History
  timeframe: Timeframe
  indicators: Indicators
  settings: ChartSettings
  screenshotRef?: RefObject<(() => void) | null>
  lines: TrendLine[]
  tool: Tool
  onLinesChange: (lines: TrendLine[]) => void
  onToolDone: () => void
}

const formatFetchedAt = (fetchedAt: string): string =>
  new Date(fetchedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

export const ChartView = ({
  history,
  timeframe,
  indicators,
  settings,
  screenshotRef,
  lines,
  tool,
  onLinesChange,
  onToolDone,
}: ChartViewProps) => {
  const theme = useTheme()
  const { containerRef, handles, data, rsiPaneTop, hover } = useChart({ history, timeframe, theme, indicators, settings })
  const { selectedLine, updateLine, deleteSelected } = useDrawing({
    handles,
    symbol: history.info.symbol,
    lines,
    timeframe,
    rsiVisible: indicators.rsi.visible,
    tool,
    onToolDone,
    onLinesChange,
    defaultColor: theme.chart.line,
    handleFill: theme.chart.bg,
    priceBasis: splitBasis(history.splits),
  })
  const symbol = history.info.symbol

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
      />
      {selectedLine && <LineToolbar line={selectedLine} onChange={updateLine} onDelete={deleteSelected} />}
      {history.stale && (
        <Styles.Notice role="status">Datos del {formatFetchedAt(history.fetchedAt)}: sin conexión con la fuente</Styles.Notice>
      )}
    </Styles.Wrapper>
  )
}
