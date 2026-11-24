import { useTheme } from 'styled-components'
import { displaySymbol } from '../../../shared/symbols'
import type { ExtendedQuote, ExtendedSession, Quote, SymbolInfo } from '../../../shared/types'
import { formatPercent, formatPrice } from '../../chart/format'
import { SymbolLogo } from '../SymbolLogo'
import * as Styles from './styles'

type SymbolRowProps = {
  item: SymbolInfo
  quote: Quote | undefined
  active: boolean
  onSelect: () => void
  onRemove: () => void
}

const MISSING = '—'
const SESSION_LABELS: Record<ExtendedSession, string> = { pre: 'Pre-market', post: 'Post-market' }

const describeExtended = (extended: ExtendedQuote, symbol: string): string =>
  `${SESSION_LABELS[extended.session]}: ${formatPrice(extended.price, symbol)} (${formatPercent(extended.changePercent)})`

export const SymbolRow = ({ item, quote, active, onSelect, onRemove }: SymbolRowProps) => {
  const theme = useTheme()
  const extended = quote?.extended ?? null
  const changeColor = quote ? (quote.change < 0 ? theme.ui.down : theme.ui.up) : undefined

  return (
    <>
      <Styles.RowButton type="button" title={item.name} aria-current={active ? 'true' : undefined} onClick={onSelect}>
        <Styles.Symbol>
          <SymbolLogo symbol={item.symbol} />
          <Styles.Ticker>{displaySymbol(item.symbol)}</Styles.Ticker>
          {extended && (
            <Styles.SessionDot
              $session={extended.session}
              role="img"
              aria-label={SESSION_LABELS[extended.session]}
              title={SESSION_LABELS[extended.session]}
            />
          )}
        </Styles.Symbol>
        <Styles.Number $wideOnly>{quote ? formatPrice(quote.price, item.symbol) : MISSING}</Styles.Number>
        <Styles.Number $color={changeColor}>{quote ? formatPercent(quote.changePercent) : MISSING}</Styles.Number>
        {extended ? (
          <Styles.Number
            $widestOnly
            $color={extended.changePercent < 0 ? theme.ui.down : theme.ui.up}
            title={describeExtended(extended, item.symbol)}
          >
            {formatPercent(extended.changePercent)}
          </Styles.Number>
        ) : (
          <Styles.Number $widestOnly>{MISSING}</Styles.Number>
        )}
      </Styles.RowButton>
      <Styles.RemoveButton type="button" aria-label={`Remove ${displaySymbol(item.symbol)}`} onClick={onRemove}>
        ×
      </Styles.RemoveButton>
    </>
  )
}
