import { useState } from 'react'
import { currencyPair } from '../../../shared/symbols'
import { type LogoShape, readShape } from './logoShape'
import * as Styles from './styles'

type SymbolLogoProps = { symbol: string; size?: number }

type LogoState = { symbol: string; status: 'loading' | 'loaded' | 'missing'; shape: LogoShape }

const initialOf = (symbol: string): string => symbol.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?'

const FLAG_SCALE = 0.72
const REGIONAL_A = 0x1f1e6
const LETTER_A = 65
const NO_COUNTRY = 'X'

const flagOf = (currency: string): string | null => {
  if (currency.startsWith(NO_COUNTRY)) return null
  const country = currency === 'EUR' ? 'EU' : currency.slice(0, 2)
  return String.fromCodePoint(...[...country].map((letter) => REGIONAL_A + letter.charCodeAt(0) - LETTER_A))
}

const CurrencyFlag = ({ currency, size, front }: { currency: string; size: number; front: boolean }) => {
  const flag = flagOf(currency)
  return (
    <Styles.Flag data-currency={currency} $size={size} $front={front}>
      {flag ? <Styles.Emoji $size={size}>{flag}</Styles.Emoji> : currency.charAt(0)}
    </Styles.Flag>
  )
}

const PairLogo = ({ pair: [base, quote], size }: { pair: [string, string]; size: number }) => {
  const flagSize = Math.round(size * FLAG_SCALE)
  return (
    <Styles.Pair $size={size} aria-hidden="true">
      <CurrencyFlag currency={quote} size={flagSize} front={false} />
      <CurrencyFlag currency={base} size={flagSize} front />
    </Styles.Pair>
  )
}

const CompanyLogo = ({ symbol, size }: { symbol: string; size: number }) => {
  const [state, setState] = useState<LogoState>({ symbol, status: 'loading', shape: 'mark' })
  const status = state.symbol === symbol ? state.status : 'loading'
  const shape = status === 'loaded' ? state.shape : 'mark'

  return (
    <Styles.Badge $size={size} aria-hidden="true">
      {status !== 'loaded' && initialOf(symbol)}
      {status !== 'missing' && (
        <Styles.Image
          key={symbol}
          src={`/api/logo?symbol=${encodeURIComponent(symbol)}`}
          alt=""
          draggable={false}
          data-loaded={status === 'loaded'}
          data-shape={shape}
          $shape={shape}
          onLoad={(event) => setState({ symbol, status: 'loaded', shape: readShape(event.currentTarget) })}
          onError={() => setState({ symbol, status: 'missing', shape: 'mark' })}
        />
      )}
    </Styles.Badge>
  )
}

export const SymbolLogo = ({ symbol, size = 20 }: SymbolLogoProps) => {
  const pair = currencyPair(symbol)
  return pair ? <PairLogo pair={pair} size={size} /> : <CompanyLogo symbol={symbol} size={size} />
}
