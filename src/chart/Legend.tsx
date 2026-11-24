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
}

const LEGEND_PADDING = 8
const PRICE_FIELDS = [
  ['O', 'open'],
  ['H', 'high'],
  ['L', 'low'],
  ['C', 'close'],
] as const

export const Legend = ({ info, timeframe, values, indicators, rsiPaneTop }: LegendProps) => {
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
                <Styles.LegendValue $color={barColor}>{formatPrice(bar[field])}</Styles.LegendValue>
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
          </Styles.LegendRow>
        )}
        {indicators.sma.length > 0 && (
          <Styles.LegendRow>
            {indicators.sma.map((item, index) => {
              const value = values?.smas[index] ?? null
              return (
                <Styles.LegendPair key={item.id}>
                  <Styles.LegendLabel>{`SMA ${item.length} close`}</Styles.LegendLabel>
                  {value !== null && <Styles.LegendValue $color={item.color}>{formatPrice(value)}</Styles.LegendValue>}
                </Styles.LegendPair>
              )
            })}
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
    </>
  )
}
