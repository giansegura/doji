import { type DragEvent, type ReactNode, useState } from 'react'
import { useTheme } from 'styled-components'
import type { ExtendedQuote, ExtendedSession, Quote, SymbolInfo } from '../../../shared/types'
import { formatPercent, formatPrice } from '../../chart/format'
import { SymbolLogo } from '../SymbolLogo'
import * as Styles from './styles'

type WatchlistProps = {
  items: SymbolInfo[]
  quotes: Record<string, Quote>
  activeSymbol: string
  onSelect: (symbol: string) => void
  onRemove: (symbol: string) => void
  onMove: (from: number, to: number) => void
  onAdd: () => void
  header?: ReactNode
}

const MISSING = '—'
const SESSION_LABELS: Record<ExtendedSession, string> = { pre: 'Pre-market', post: 'Post-market' }

const describeExtended = (extended: ExtendedQuote): string =>
  `${SESSION_LABELS[extended.session]}: ${formatPrice(extended.price)} (${formatPercent(extended.changePercent)})`
const DRAG_FORMAT = 'application/x-doji-symbol'

export const Watchlist = ({ items, quotes, activeSymbol, onSelect, onRemove, onMove, onAdd, header }: WatchlistProps) => {
  const theme = useTheme()
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const handleDragStart = (event: DragEvent, index: number) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_FORMAT, items[index].symbol)
    setDragIndex(index)
  }

  const handleDrop = (event: DragEvent, index: number) => {
    event.preventDefault()
    if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index)
    setDragIndex(null)
  }

  const colorOf = (quote: Quote | undefined): string | undefined => {
    if (!quote) return undefined
    return quote.change < 0 ? theme.ui.down : theme.ui.up
  }

  return (
    <Styles.Panel>
      <Styles.Header>
        {header ?? <Styles.Title>Watchlist</Styles.Title>}
        <Styles.IconButton type="button" aria-label="Add symbol" title="Add symbol" onClick={onAdd}>
          +
        </Styles.IconButton>
      </Styles.Header>
      <Styles.Columns>
        <Styles.ColumnLabel>Symbol</Styles.ColumnLabel>
        <Styles.ColumnLabel $right $wideOnly>
          Last
        </Styles.ColumnLabel>
        <Styles.ColumnLabel $right>Change %</Styles.ColumnLabel>
        <Styles.ColumnLabel $right $widestOnly>
          Ext
        </Styles.ColumnLabel>
      </Styles.Columns>
      {items.length === 0 && <Styles.Empty>This watchlist is empty</Styles.Empty>}
      <Styles.Rows>
        {items.map((item, index) => {
          const quote = quotes[item.symbol]
          const extended = quote?.extended ?? null
          return (
            <Styles.Row
              key={item.symbol}
              draggable
              $dragging={dragIndex === index}
              onDragStart={(event) => handleDragStart(event, index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, index)}
              onDragEnd={() => setDragIndex(null)}
            >
              <Styles.RowButton
                type="button"
                title={item.name}
                aria-current={item.symbol === activeSymbol ? 'true' : undefined}
                onClick={() => onSelect(item.symbol)}
              >
                <Styles.Symbol>
                  <SymbolLogo symbol={item.symbol} />
                  <Styles.Ticker>{item.symbol}</Styles.Ticker>
                  {extended && (
                    <Styles.SessionDot
                      $session={extended.session}
                      role="img"
                      aria-label={SESSION_LABELS[extended.session]}
                      title={SESSION_LABELS[extended.session]}
                    />
                  )}
                </Styles.Symbol>
                <Styles.Number $wideOnly>{quote ? formatPrice(quote.price) : MISSING}</Styles.Number>
                <Styles.Number $color={colorOf(quote)}>
                  {quote ? formatPercent(quote.changePercent) : MISSING}
                </Styles.Number>
                {extended ? (
                  <Styles.Number
                    $widestOnly
                    $color={extended.changePercent < 0 ? theme.ui.down : theme.ui.up}
                    title={describeExtended(extended)}
                  >
                    {formatPercent(extended.changePercent)}
                  </Styles.Number>
                ) : (
                  <Styles.Number $widestOnly>{MISSING}</Styles.Number>
                )}
              </Styles.RowButton>
              <Styles.RemoveButton type="button" aria-label={`Remove ${item.symbol}`} onClick={() => onRemove(item.symbol)}>
                ×
              </Styles.RemoveButton>
            </Styles.Row>
          )
        })}
      </Styles.Rows>
    </Styles.Panel>
  )
}
