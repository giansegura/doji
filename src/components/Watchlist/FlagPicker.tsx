import { useEffect, useRef, useState } from 'react'
import { FLAG_COLORS } from '../../../shared/flags'
import { displaySymbol } from '../../../shared/symbols'
import type { FlagColor } from '../../../shared/types'
import { FLAG_NAMES } from '../../domain/flags'
import * as Styles from './styles'

type FlagPickerProps = { symbol: string; flag: FlagColor | null; onFlag: (color: FlagColor | null) => void }

export const FlagIcon = () => (
  <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
    <path d="M1 0.5h1.2v11H1z" />
    <path d="M2.2 1h6.6L7.2 3.6l1.6 2.6H2.2z" />
  </svg>
)

export const FlagPicker = ({ symbol, flag, onFlag }: FlagPickerProps) => {
  const [open, setOpen] = useState(false)
  const paletteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const handleDown = (event: PointerEvent) => {
      if (!paletteRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handleDown)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [open])

  const choose = (color: FlagColor | null) => {
    onFlag(color)
    setOpen(false)
  }

  return (
    <>
      <Styles.FlagButton
        type="button"
        aria-label={`Flag ${displaySymbol(symbol)}`}
        title={flag ? `${FLAG_NAMES[flag]} flag` : 'Flag'}
        aria-expanded={open}
        $color={flag}
        onClick={() => setOpen((current) => !current)}
      >
        <FlagIcon />
      </Styles.FlagButton>
      {open && (
        <Styles.FlagPalette ref={paletteRef} role="group" aria-label="Flag colour">
          {FLAG_COLORS.map((color) => (
            <Styles.Swatch
              key={color}
              type="button"
              aria-label={FLAG_NAMES[color]}
              title={FLAG_NAMES[color]}
              aria-pressed={flag === color}
              $color={color}
              onClick={() => choose(color)}
            />
          ))}
          <Styles.NoFlag type="button" onClick={() => choose(null)}>
            No flag
          </Styles.NoFlag>
        </Styles.FlagPalette>
      )}
    </>
  )
}
