import { type FormEvent, useState } from 'react'
import { useTheme } from 'styled-components'
import { isHolding } from '../../../shared/holdings'
import { displaySymbol } from '../../../shared/symbols'
import type { Holding } from '../../../shared/types'
import { formatPercent, formatPrice } from '../../chart/format'
import { formatMoney, holdingGain } from '../../domain/holdings'
import * as Styles from './styles'

type PositionPanelProps = {
  symbol: string
  holding: Holding | undefined
  price: number | null
  currency: string | undefined
  onChange: (holding: Holding | null) => void
}

const textOf = (value: number | undefined): string => (value === undefined ? '' : String(value))

export const PositionPanel = ({ symbol, holding, price, currency, onChange }: PositionPanelProps) => {
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const [shares, setShares] = useState(() => textOf(holding?.quantity))
  const [average, setAverage] = useState(() => textOf(holding?.price))
  const [shownFor, setShownFor] = useState({ symbol, holding })
  const gain = holding && price !== null ? holdingGain(holding, price) : null

  if (shownFor.symbol !== symbol || shownFor.holding !== holding) {
    setShownFor({ symbol, holding })
    setShares(textOf(holding?.quantity))
    setAverage(textOf(holding?.price))
  }

  const save = () => {
    const next = { quantity: Number(shares), price: Number(average) }
    if (isHolding(next) && (next.quantity !== holding?.quantity || next.price !== holding?.price)) onChange(next)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    save()
  }

  return (
    <Styles.Panel>
      <Styles.Toggle
        type="button"
        aria-label={`Position in ${displaySymbol(symbol)}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Styles.Label>Position</Styles.Label>
        {holding && <Styles.Muted>{`${holding.quantity} @ ${formatPrice(holding.price, symbol)}`}</Styles.Muted>}
        {gain && (
          <Styles.Gain $color={gain.value < 0 ? theme.ui.down : theme.ui.up}>
            {`${formatPercent(gain.percent)} ${formatMoney(gain.value, currency)}`}
          </Styles.Gain>
        )}
        <Styles.Chevron $open={open}>▲</Styles.Chevron>
      </Styles.Toggle>
      {open && (
        <Styles.Form onSubmit={handleSubmit}>
          <Styles.Field>
            Shares
            <Styles.Input aria-label="Shares" type="number" min="0" step="any" value={shares} onChange={(event) => setShares(event.target.value)} onBlur={save} />
          </Styles.Field>
          <Styles.Field>
            Average price
            <Styles.Input
              aria-label="Average price"
              type="number"
              min="0"
              step="any"
              value={average}
              onChange={(event) => setAverage(event.target.value)}
              onBlur={save}
            />
          </Styles.Field>
          {holding && (
            <Styles.Remove type="button" onClick={() => onChange(null)}>
              Remove position
            </Styles.Remove>
          )}
          <button type="submit" hidden aria-hidden="true" />
        </Styles.Form>
      )}
    </Styles.Panel>
  )
}
