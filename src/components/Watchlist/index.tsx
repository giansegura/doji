import { type DragEvent, type ReactNode, useState } from 'react'
import { useTheme } from 'styled-components'
import type { Quote, SymbolInfo } from '../../../shared/types'
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
        {header ?? <Styles.Title>Lista</Styles.Title>}
        <Styles.IconButton type="button" aria-label="Añadir símbolo" title="Añadir símbolo" onClick={onAdd}>
          +
        </Styles.IconButton>
      </Styles.Header>
      <Styles.Columns>
        <Styles.ColumnLabel>Símbolo</Styles.ColumnLabel>
        <Styles.ColumnLabel $right>Último</Styles.ColumnLabel>
        <Styles.ColumnLabel $right>Cambio %</Styles.ColumnLabel>
      </Styles.Columns>
      {items.length === 0 && <Styles.Empty>La lista está vacía</Styles.Empty>}
      <Styles.Rows>
        {items.map((item, index) => {
          const quote = quotes[item.symbol]
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
                </Styles.Symbol>
                <Styles.Number>{quote ? formatPrice(quote.price) : MISSING}</Styles.Number>
                <Styles.Number $color={colorOf(quote)}>
                  {quote ? formatPercent(quote.changePercent) : MISSING}
                </Styles.Number>
              </Styles.RowButton>
              <Styles.RemoveButton type="button" aria-label={`Quitar ${item.symbol}`} onClick={() => onRemove(item.symbol)}>
                ×
              </Styles.RemoveButton>
            </Styles.Row>
          )
        })}
      </Styles.Rows>
    </Styles.Panel>
  )
}
