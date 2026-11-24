import { useState } from 'react'
import * as Styles from './styles'

type SymbolLogoProps = { symbol: string; size?: number }

type LogoState = { symbol: string; status: 'loading' | 'loaded' | 'missing' }

const initialOf = (symbol: string): string => symbol.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?'

export const SymbolLogo = ({ symbol, size = 20 }: SymbolLogoProps) => {
  const [state, setState] = useState<LogoState>({ symbol, status: 'loading' })
  const status = state.symbol === symbol ? state.status : 'loading'

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
          onLoad={() => setState({ symbol, status: 'loaded' })}
          onError={() => setState({ symbol, status: 'missing' })}
        />
      )}
    </Styles.Badge>
  )
}
