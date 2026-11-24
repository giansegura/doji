import { type RefObject, useState } from 'react'
import { displaySymbol } from '../../../shared/symbols'
import type { ChartSettings, Drawing, DrawingKind, History, Indicators, LineLook, Timeframe } from '../../../shared/types'
import { ChartView } from '../../chart/ChartView'
import type { LivePrice } from '../../domain/liveBar'
import type { Tool } from '../../state/appReducer'
import * as Styles from '../../styles'

type ChartAreaProps = {
  symbol: string
  status: 'loading' | 'ready' | 'error'
  history: History | null
  errorCode: string | null
  timeframe: Timeframe
  indicators: Indicators
  settings: ChartSettings
  live?: LivePrice | null
  viewId?: string
  screenshotRef?: RefObject<(() => void) | null>
  lines: Drawing[]
  tool: Tool
  onLinesChange: (lines: Drawing[]) => void
  looks: Partial<Record<DrawingKind, LineLook>>
  onLook: (kind: DrawingKind, look: LineLook) => void
  onToolDone: () => void
  onRetry: () => void
}

const NO_LINES: Drawing[] = []

const ignore = (): void => undefined

const hasBars = (history: History | null): history is History => history !== null && history.bars.length > 0

export const ChartArea = ({
  symbol,
  status,
  history,
  errorCode,
  timeframe,
  indicators,
  settings,
  live = null,
  viewId = 'main',
  screenshotRef,
  lines,
  tool,
  onLinesChange,
  looks,
  onLook,
  onToolDone,
  onRetry,
}: ChartAreaProps) => {
  const [lastShown, setLastShown] = useState<History | null>(hasBars(history) ? history : null)
  const loading = status === 'loading'
  const shown = hasBars(history) ? history : loading ? lastShown : null

  if (hasBars(history) && history !== lastShown) setLastShown(history)

  if (loading && !shown) return <Styles.Message>Loading…</Styles.Message>

  if (errorCode === 'not_found' || (history && history.bars.length === 0)) {
    return <Styles.Message>No data for {displaySymbol(symbol)}</Styles.Message>
  }

  if (!shown) {
    return (
      <Styles.Message>
        Could not load the data
        <Styles.ActionButton type="button" onClick={onRetry}>
          Retry
        </Styles.ActionButton>
      </Styles.Message>
    )
  }

  return (
    <>
      <ChartView
        history={shown}
        timeframe={timeframe}
        indicators={indicators}
        settings={settings}
        live={live}
        viewId={viewId}
        screenshotRef={screenshotRef}
        lines={loading ? NO_LINES : lines}
        tool={loading ? 'cursor' : tool}
        onLinesChange={loading ? ignore : onLinesChange}
        looks={looks}
        onLook={loading ? ignore : onLook}
        onToolDone={loading ? ignore : onToolDone}
      />
      {loading && <Styles.Veil role="status">{`Loading ${displaySymbol(symbol)}…`}</Styles.Veil>}
    </>
  )
}
