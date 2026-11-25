import { useState } from 'react'
import { useTheme } from 'styled-components'
import type { TickerItem } from '../../../shared/ticker'
import type { Quote } from '../../../shared/types'
import { formatPercent, formatPrice } from '../../chart/format'
import * as Styles from './styles'

type MarketTickerProps = {
  items: TickerItem[]
  quotes: Record<string, Quote>
  active: string
  onPick: (symbol: string) => void
  onAdd: () => void
  onRemove: (symbol: string) => void
  onHide: () => void
}

type MarketProps = { item: TickerItem; quote: Quote | undefined; active: boolean; onPick: (symbol: string) => void }

const MISSING = '—'
const LABEL = 'Market ticker'

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M10.5 2.5l3 3L6 13H3v-3z" strokeLinejoin="round" />
  </svg>
)

const Market = ({ item, quote, active, onPick }: MarketProps) => {
  const theme = useTheme()
  const price = quote ? formatPrice(quote.price, item.symbol) : MISSING
  const change = quote ? formatPercent(quote.changePercent) : ''
  const color = quote && quote.change < 0 ? theme.ui.down : theme.ui.up
  return (
    <Styles.Market
      type="button"
      title={`Open the ${item.name} chart`}
      aria-label={[item.name, price, change].filter(Boolean).join(' ')}
      aria-current={active ? 'true' : undefined}
      $active={active}
      onClick={() => onPick(item.symbol)}
    >
      <Styles.Name>{item.name}</Styles.Name>
      <Styles.Price>{price}</Styles.Price>
      {quote && <Styles.Change $color={color}>{change}</Styles.Change>}
    </Styles.Market>
  )
}

export const MarketTicker = ({ items, quotes, active, onPick, onAdd, onRemove, onHide }: MarketTickerProps) => {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <Styles.Strip aria-label={LABEL}>
        <Styles.Markets>
          {items.map((item) => (
            <Styles.Chip key={item.symbol}>
              <Styles.Name>{item.name}</Styles.Name>
              <Styles.Remove type="button" aria-label={`Remove ${item.name} from the ticker`} onClick={() => onRemove(item.symbol)}>
                ×
              </Styles.Remove>
            </Styles.Chip>
          ))}
        </Styles.Markets>
        <Styles.Action type="button" onClick={onAdd}>
          Add to ticker
        </Styles.Action>
        <Styles.Action type="button" onClick={onHide}>
          Hide ticker
        </Styles.Action>
        <Styles.Action type="button" $strong onClick={() => setEditing(false)}>
          Done
        </Styles.Action>
      </Styles.Strip>
    )
  }

  return (
    <Styles.Strip aria-label={LABEL}>
      <Styles.Markets>
        {items.map((item) => (
          <Market key={item.symbol} item={item} quote={quotes[item.symbol]} active={item.symbol === active} onPick={onPick} />
        ))}
        {items.length === 0 && (
          <Styles.Action type="button" onClick={onAdd}>
            Add to ticker
          </Styles.Action>
        )}
      </Styles.Markets>
      <Styles.Edit type="button" aria-label="Edit ticker" title="Edit ticker" onClick={() => setEditing(true)}>
        <EditIcon />
      </Styles.Edit>
    </Styles.Strip>
  )
}
