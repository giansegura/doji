import { useTheme } from 'styled-components'
import { displaySymbol } from '../../../shared/symbols'
import type { SymbolMetrics } from '../../../shared/symbolMetrics'
import type { Earnings, ExtendedQuote, ExtendedSession, FlagColor, Holding, Quote, SymbolInfo, WatchColumn } from '../../../shared/types'
import { formatPercent, formatPrice } from '../../chart/format'
import { columnCell } from '../../domain/watchColumns'
import { SymbolLogo } from '../SymbolLogo'
import { FlagPicker } from './FlagPicker'
import { LastPrice } from './LastPrice'
import * as Styles from './styles'

type SymbolRowProps = {
  item: SymbolInfo
  quote: Quote | undefined
  active: boolean
  earningsIn?: number
  columns?: WatchColumn[]
  metrics?: SymbolMetrics
  earnings?: Earnings
  flag?: FlagColor | null
  holding?: Holding
  onFlag?: (color: FlagColor | null) => void
  onSelect: () => void
  onRemove?: () => void
}

const MISSING = '—'
const NO_COLUMNS: WatchColumn[] = []
const SESSION_LABELS: Record<ExtendedSession, string> = { pre: 'Pre-market', post: 'Post-market' }

const describeExtended = (extended: ExtendedQuote, symbol: string): string =>
  `${SESSION_LABELS[extended.session]}: ${formatPrice(extended.price, symbol)} (${formatPercent(extended.changePercent)})`

const earningsLabel = (days: number): string => (days === 0 ? 'Earnings today' : `Earnings in ${days} ${days === 1 ? 'day' : 'days'}`)

export const SymbolRow = ({
  item,
  quote,
  active,
  earningsIn,
  columns = NO_COLUMNS,
  metrics,
  earnings,
  flag = null,
  holding,
  onFlag,
  onSelect,
  onRemove,
}: SymbolRowProps) => {
  const theme = useTheme()
  const extended = quote?.extended ?? null
  const extra = columns.length
  const changeColor = quote ? (quote.change < 0 ? theme.ui.down : theme.ui.up) : undefined

  return (
    <>
      <Styles.RowButton type="button" title={item.name} aria-current={active ? 'true' : undefined} $extra={extra} onClick={onSelect}>
        <Styles.Symbol>
          <SymbolLogo symbol={item.symbol} />
          <Styles.Ticker>{displaySymbol(item.symbol)}</Styles.Ticker>
          {earningsIn !== undefined && (
            <Styles.EarningsSoon role="img" aria-label={earningsLabel(earningsIn)} title={earningsLabel(earningsIn)}>
              {earningsIn === 0 ? 'E' : `E ${earningsIn}d`}
            </Styles.EarningsSoon>
          )}
          {extended && (
            <Styles.SessionDot
              $session={extended.session}
              role="img"
              aria-label={SESSION_LABELS[extended.session]}
              title={SESSION_LABELS[extended.session]}
            />
          )}
        </Styles.Symbol>
        <Styles.Number $wideOnly $extra={extra}>
          {quote ? <LastPrice price={quote.price} symbol={item.symbol} /> : MISSING}
        </Styles.Number>
        <Styles.Number $color={changeColor}>{quote ? formatPercent(quote.changePercent) : MISSING}</Styles.Number>
        {extended ? (
          <Styles.Number
            $widestOnly
            $extra={extra}
            $color={extended.changePercent < 0 ? theme.ui.down : theme.ui.up}
            title={describeExtended(extended, item.symbol)}
          >
            {formatPercent(extended.changePercent)}
          </Styles.Number>
        ) : (
          <Styles.Number $widestOnly $extra={extra}>
            {MISSING}
          </Styles.Number>
        )}
        {columns.map((column) => {
          const cell = columnCell(column, { symbol: item.symbol, metrics, earnings, holding, quote })
          return (
            <Styles.Number key={column} title={cell.title}>
              {cell.text}
            </Styles.Number>
          )
        })}
      </Styles.RowButton>
      {onFlag && <FlagPicker symbol={item.symbol} flag={flag} onFlag={onFlag} />}
      {onRemove && (
        <Styles.RemoveButton type="button" aria-label={`Remove ${displaySymbol(item.symbol)}`} onClick={onRemove}>
          ×
        </Styles.RemoveButton>
      )}
    </>
  )
}
