import { useState } from 'react'
import { formatPrice } from '../../chart/format'
import { type PriceFlash, priceFlash } from '../../domain/priceFlash'
import * as Styles from './styles'

type LastPriceProps = { price: number; symbol: string }

type Shown = { price: number; text: string; flash: PriceFlash | null; turn: number }

const WHOLE_MS = 500
const DIGITS_MS = 2500

export const LastPrice = ({ price, symbol }: LastPriceProps) => {
  const text = formatPrice(price, symbol)
  const [shown, setShown] = useState<Shown>({ price, text, flash: null, turn: 0 })
  const { flash } = shown

  if (price !== shown.price) {
    const next = priceFlash(shown, { price, text })
    setShown({ price, text, flash: next ?? shown.flash, turn: next ? shown.turn + 1 : shown.turn })
  }

  if (!flash) return <>{text}</>

  return (
    <span key={shown.turn} data-flash={flash.direction}>
      <Styles.FlashPart $up={flash.direction === 'up'} $ms={WHOLE_MS}>
        {text.slice(0, flash.from)}
      </Styles.FlashPart>
      <Styles.FlashPart $up={flash.direction === 'up'} $ms={DIGITS_MS}>
        {text.slice(flash.from)}
      </Styles.FlashPart>
    </span>
  )
}
