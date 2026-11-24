import { type RefObject, useState } from 'react'
import type { ChartSettings, History, Indicators, Timeframe, TrendLine } from '../../../shared/types'
import { ChartView } from '../../chart/ChartView'
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
  screenshotRef?: RefObject<(() => void) | null>
  lines: TrendLine[]
  tool: Tool
  onLinesChange: (lines: TrendLine[]) => void
  onToolDone: () => void
  onRetry: () => void
}

const NO_LINES: TrendLine[] = []

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
  screenshotRef,
  lines,
  tool,
  onLinesChange,
  onToolDone,
  onRetry,
}: ChartAreaProps) => {
  const [lastShown, setLastShown] = useState<History | null>(hasBars(history) ? history : null)
  const loading = status === 'loading'
  const shown = hasBars(history) ? history : loading ? lastShown : null

  if (hasBars(history) && history !== lastShown) setLastShown(history)

  if (loading && !shown) return <Styles.Message>Cargando…</Styles.Message>

  if (errorCode === 'not_found' || (history && history.bars.length === 0)) {
    return <Styles.Message>No hay datos para {symbol}</Styles.Message>
  }

  if (!shown) {
    return (
      <Styles.Message>
        No se pudieron cargar los datos
        <Styles.ActionButton type="button" onClick={onRetry}>
          Reintentar
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
        screenshotRef={screenshotRef}
        lines={loading ? NO_LINES : lines}
        tool={loading ? 'cursor' : tool}
        onLinesChange={loading ? ignore : onLinesChange}
        onToolDone={loading ? ignore : onToolDone}
      />
      {loading && <Styles.Veil role="status">{`Cargando ${symbol}…`}</Styles.Veil>}
    </>
  )
}
