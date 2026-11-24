import { useTheme } from 'styled-components'
import type { Indicators, SymbolInfo, Timeframe } from '../../shared/types'
import { SymbolLogo } from '../components/SymbolLogo'
import { formatPercent, formatPrice, formatSigned, formatVolume } from './format'
import type { HoverValues } from './seriesData'
import * as Styles from './styles'

export type LegendProps = {
  info: SymbolInfo
  timeframe: Timeframe
  values: HoverValues | null
  indicators: Indicators
  rsiPaneTop: number | null
  macdPaneTop: number | null
}

const LEGEND_PADDING = 8
const PRICE_FIELDS = [
  ['O', 'open'],
  ['H', 'high'],
  ['L', 'low'],
  ['C', 'close'],
] as const

export const Legend = ({ info, timeframe, values, indicators, rsiPaneTop, macdPaneTop }: LegendProps) => {
  const theme = useTheme()
  const bar = values?.bar ?? null
  const rsi = values?.rsi ?? null
  const rsiMa = values?.rsiMa ?? null
  const reference = values?.previousClose ?? bar?.open ?? 0
  const change = bar ? bar.close - reference : 0
  const changePercent = reference !== 0 ? (change / reference) * 100 : 0
  const barColor = change >= 0 ? theme.chart.up : theme.chart.down
  const title = [info.name, `1${timeframe}`, info.exchange].filter(Boolean).join(' · ')
  const showRsi = indicators.rsi.visible && rsiPaneTop !== null
  const volumeMa = indicators.volumeMa.visible ? (values?.volumeMa ?? null) : null
  const bands = indicators.bollinger.visible ? (values?.bands ?? null) : null
  const macd = values?.macd ?? null
  const showMacd = indicators.macd.visible && macdPaneTop !== null
  const histogramColor = (macd?.histogram ?? 0) < 0 ? theme.chart.down : theme.chart.up

  return (
    <>
      <Styles.Legend $top={LEGEND_PADDING}>
        <Styles.LegendRow>
          <SymbolLogo symbol={info.symbol} size={18} />
          <Styles.LegendTitle>{title}</Styles.LegendTitle>
          {bar &&
            PRICE_FIELDS.map(([label, field]) => (
              <Styles.LegendPair key={field}>
                <Styles.LegendLabel>{label}</Styles.LegendLabel>
                <Styles.LegendValue $color={barColor}>{formatPrice(bar[field], info.symbol)}</Styles.LegendValue>
              </Styles.LegendPair>
            ))}
          {bar && (
            <Styles.LegendValue $color={barColor}>
              {`${formatSigned(change)} (${formatPercent(changePercent)})`}
            </Styles.LegendValue>
          )}
        </Styles.LegendRow>
        {bar && indicators.volume.visible && (
          <Styles.LegendRow>
            <Styles.LegendLabel>Vol</Styles.LegendLabel>
            <Styles.LegendValue $color={theme.ui.text}>{formatVolume(bar.volume)}</Styles.LegendValue>
            {volumeMa !== null && (
              <Styles.LegendValue $color={theme.chart.volumeMa}>{formatVolume(volumeMa)}</Styles.LegendValue>
            )}
          </Styles.LegendRow>
        )}
        {indicators.sma.length > 0 && (
          <Styles.LegendRow>
            {indicators.sma.map((item, index) => {
              const value = values?.smas[index] ?? null
              return (
                <Styles.LegendPair key={item.id}>
                  <Styles.LegendLabel>{`${item.kind === 'ema' ? 'EMA' : 'SMA'} ${item.length} close`}</Styles.LegendLabel>
                  {value !== null && <Styles.LegendValue $color={item.color}>{formatPrice(value, info.symbol)}</Styles.LegendValue>}
                </Styles.LegendPair>
              )
            })}
          </Styles.LegendRow>
        )}
        {indicators.bollinger.visible && (
          <Styles.LegendRow>
            <Styles.LegendLabel>{`BB ${indicators.bollinger.length} ${indicators.bollinger.multiplier}`}</Styles.LegendLabel>
            {bands?.basis != null && <Styles.LegendValue $color={theme.chart.bandBasis}>{formatPrice(bands.basis, info.symbol)}</Styles.LegendValue>}
            {bands?.upper != null && <Styles.LegendValue $color={theme.chart.band}>{formatPrice(bands.upper, info.symbol)}</Styles.LegendValue>}
            {bands?.lower != null && <Styles.LegendValue $color={theme.chart.band}>{formatPrice(bands.lower, info.symbol)}</Styles.LegendValue>}
          </Styles.LegendRow>
        )}
      </Styles.Legend>
      {showRsi && (
        <Styles.Legend $top={rsiPaneTop + LEGEND_PADDING}>
          <Styles.LegendRow>
            <Styles.LegendLabel>{`RSI ${indicators.rsi.length} close`}</Styles.LegendLabel>
            {rsi !== null && <Styles.LegendValue $color={theme.chart.rsi}>{rsi.toFixed(2)}</Styles.LegendValue>}
            {indicators.rsi.showMa && rsiMa !== null && (
              <Styles.LegendValue $color={theme.chart.rsiMa}>{rsiMa.toFixed(2)}</Styles.LegendValue>
            )}
          </Styles.LegendRow>
        </Styles.Legend>
      )}
      {showMacd && (
        <Styles.Legend $top={macdPaneTop + LEGEND_PADDING}>
          <Styles.LegendRow>
            <Styles.LegendLabel>{`MACD ${indicators.macd.fast} ${indicators.macd.slow} ${indicators.macd.signal}`}</Styles.LegendLabel>
            {macd?.histogram != null && <Styles.LegendValue $color={histogramColor}>{macd.histogram.toFixed(2)}</Styles.LegendValue>}
            {macd?.line != null && <Styles.LegendValue $color={theme.chart.macd}>{macd.line.toFixed(2)}</Styles.LegendValue>}
            {macd?.signal != null && <Styles.LegendValue $color={theme.chart.macdSignal}>{macd.signal.toFixed(2)}</Styles.LegendValue>}
          </Styles.LegendRow>
        </Styles.Legend>
      )}
    </>
  )
}
