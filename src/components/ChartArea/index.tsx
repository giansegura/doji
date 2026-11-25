import { type RefObject, useState } from 'react'
import { displaySymbol } from '../../../shared/symbols'
import type { ChartSettings, Drawing, DrawingKind, History, Indicators, LineLook, Timeframe, Holding } from '../../../shared/types'
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
  asOf?: string | null
  onPickBar?: (time: string) => void
  screenshotRef?: RefObject<(() => void) | null>
  lines: Drawing[]
  tool: Tool
  onLinesChange: (lines: Drawing[]) => void
  looks: Partial<Record<DrawingKind, LineLook>>
  onLook: (kind: DrawingKind, look: LineLook) => void
  onToolDone: () => void
  onRetry: () => void
  holding?: Holding
  currency?: string
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
  asOf = null,
  onPickBar,
  screenshotRef,
  lines,
  tool,
  onLinesChange,
  looks,
  onLook,
  onToolDone,
  onRetry,
  holding,
  currency,
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
        asOf={asOf}
        onPickBar={onPickBar}
        screenshotRef={screenshotRef}
        lines={loading ? NO_LINES : lines}
        tool={loading ? 'cursor' : tool}
        onLinesChange={loading ? ignore : onLinesChange}
        looks={looks}
        onLook={loading ? ignore : onLook}
        onToolDone={loading ? ignore : onToolDone}
        holding={loading ? undefined : holding}
        currency={currency}
      />
      {loading && <Styles.Veil role="status">{`Loading ${displaySymbol(symbol)}…`}</Styles.Veil>}
    </>
  )
}
