import { type RefObject, useEffect, useMemo } from 'react'
import { useTheme } from 'styled-components'
import type { ChartSettings, Dividend, Drawing, DrawingKind, History, Holding, Indicators, LineLook, Timeframe } from '../../shared/types'
import { changedLook, kindOf } from '../domain/lineLooks'
import type { LivePrice } from '../domain/liveBar'
import { dividendsAsOf, earningsAsOf } from '../domain/replay'
import { splitBasis } from '../domain/splits'
import { askToNotify } from '../hooks/useAlerts'
import { useEarnings } from '../hooks/useEarnings'
import type { Tool } from '../state/appReducer'
import { LineToolbar } from './LineToolbar'
import { RangeBar } from './RangeBar'
import { type RangeKey, centerOn, rangeOf } from './rangeButtons'
import { todayIso } from '../../shared/dates'
import { LiveLegend } from './LiveLegend'
import { nextEarningsLabel } from './earningsMarks'
import { imageName, saveChartImage } from './screenshot'
import * as Styles from './styles'
import { type ViewStore, sharedViewStore } from './savedViews'
import { useAutoFit } from './useAutoFit'
import { useBackToPresent } from './useBackToPresent'
import { usePositionLine } from './usePositionLine'
import { usePickBar } from './usePickBar'
import { useChart } from './useChart'
import { useDrawing } from './useDrawing'
import { useEarningsMarks } from './useEarningsMarks'
import { LEVEL_LOOK } from './levelsPrimitive'
import { useLevels } from './useLevels'
import { useVolumeProfile } from './useVolumeProfile'

type ChartViewProps = {
  history: History
  timeframe: Timeframe
  indicators: Indicators
  settings: ChartSettings
  live?: LivePrice | null
  viewId?: string
  asOf?: string | null
  onPickBar?: (time: string, timeframe: Timeframe) => void
  screenshotRef?: RefObject<(() => void) | null>
  lines: Drawing[]
  tool: Tool
  onLinesChange: (lines: Drawing[]) => void
  looks?: Partial<Record<DrawingKind, LineLook>>
  onLook?: (kind: DrawingKind, look: LineLook) => void
  onToolDone: () => void
  holding?: Holding
  currency?: string
  inEuros?: boolean
  locked?: boolean
}

const NO_LOOKS: Partial<Record<DrawingKind, LineLook>> = {}

const NO_DIVIDENDS: Dividend[] = []

const DEFAULT_SPAN = 150

const READ_ONLY_VIEWS: ViewStore = { get: (key) => sharedViewStore.get(key), set: () => undefined }

const formatFetchedAt = (fetchedAt: string): string =>
  new Date(fetchedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export const ChartView = ({
  history,
  timeframe,
  indicators,
  settings,
  live = null,
  viewId = 'main',
  asOf = null,
  onPickBar,
  screenshotRef,
  lines,
  tool,
  onLinesChange,
  looks = NO_LOOKS,
  onLook,
  onToolDone,
  holding,
  currency,
  inEuros = false,
  locked = false,
}: ChartViewProps) => {
  const theme = useTheme()
  const { containerRef, handles, data, rsiPaneTop, macdPaneTop, hover } = useChart({
    history,
    timeframe,
    theme,
    indicators,
    settings,
    live,
    viewId,
    views: asOf ? READ_ONLY_VIEWS : sharedViewStore,
    inEuros,
  })
  const { manual, release, fit } = useAutoFit(handles, history.info.symbol)
  const levels = useLevels({ handles, history, settings: indicators.levels, lines, color: theme.chart.levels })
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
    tones: { profit: theme.chart.up, loss: theme.chart.down },
    levels,
    levelLook: { ...LEVEL_LOOK, color: theme.chart.levels },
    handleFill: theme.chart.bg,
    priceBasis: splitBasis(history.splits),
    locked,
  })
  useVolumeProfile({
    handles,
    bars: data.bars,
    settings: indicators.volumeProfile,
    colors: { up: theme.chart.up, down: theme.chart.down, poc: theme.ui.accent },
  })
  const loadedEarnings = useEarnings(history.info.symbol)
  const earnings = useMemo(
    () => (loadedEarnings && indicators.marks.earnings ? earningsAsOf(loadedEarnings, asOf) : null),
    [loadedEarnings, asOf, indicators.marks.earnings],
  )
  const dividends = useMemo(
    () => (indicators.marks.dividends ? dividendsAsOf(history.dividends ?? NO_DIVIDENDS, asOf) : NO_DIVIDENDS),
    [history.dividends, asOf, indicators.marks.dividends],
  )
  usePickBar(handles, data.bars, onPickBar ? (time) => onPickBar(time, timeframe) : undefined)
  useBackToPresent(handles, asOf)
  usePositionLine({
    handles,
    holding: asOf ? undefined : holding,
    price: live?.price ?? data.bars.at(-1)?.close ?? null,
    currency,
    colors: { up: theme.chart.up, down: theme.chart.down },
  })
  useEarningsMarks({
    handles,
    earnings,
    dividends,
    colors: {
      past: theme.ui.textMuted,
      next: theme.ui.textMuted,
      background: theme.chart.bg,
      text: theme.chart.bg,
      beat: theme.chart.up,
      miss: theme.chart.down,
    },
  })
  const symbol = history.info.symbol

  const showRange = (key: RangeKey) => {
    if (!handles) return
    fit()
    handles.chart.timeScale().setVisibleLogicalRange(rangeOf(key, data.bars.map((bar) => bar.time), todayIso()))
  }

  const goTo = (date: string) => {
    if (!handles) return
    const shown = handles.chart.timeScale().getVisibleLogicalRange()
    const target = centerOn(
      date,
      data.bars.map((bar) => bar.time),
      shown ? shown.to - shown.from : DEFAULT_SPAN,
    )
    if (target) handles.chart.timeScale().setVisibleLogicalRange(target)
  }

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
        earnings={earnings ? nextEarningsLabel(earnings) : null}
        dividends={dividends}
        reports={earnings}
        inEuros={inEuros}
      />
      <RangeBar onRange={showRange} onGoTo={goTo} />
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
