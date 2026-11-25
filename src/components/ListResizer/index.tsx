import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { LIST_MIN_WIDTH } from '../../../shared/limits'
import { clampListWidth, listMaxWidth } from '../../../shared/listWidth'
import * as Styles from './styles'

type ListResizerProps = {
  width: number
  extraColumns?: number
  onResize: (width: number) => void
}

type Grip = { x: number; width: number }

const KEY_STEP = 16

export const ListResizer = ({ width, extraColumns = 0, onResize }: ListResizerProps) => {
  const [grip, setGrip] = useState<Grip | null>(null)
  const latest = useRef(onResize)

  useEffect(() => {
    latest.current = onResize
  })

  useEffect(() => {
    if (!grip) return undefined
    const handleMove = (event: PointerEvent) => latest.current(clampListWidth(grip.width + grip.x - event.clientX, extraColumns))
    const handleEnd = () => setGrip(null)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
  }, [grip, extraColumns])

  const handleDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    setGrip({ x: event.clientX, width })
  }

  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') onResize(clampListWidth(width + KEY_STEP, extraColumns))
    if (event.key === 'ArrowRight') onResize(clampListWidth(width - KEY_STEP, extraColumns))
  }

  return (
    <>
      <Styles.Handle
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Watchlist width"
        aria-valuemin={LIST_MIN_WIDTH}
        aria-valuemax={listMaxWidth(extraColumns)}
        aria-valuenow={width}
        title="Drag to resize the watchlist"
        $active={grip !== null}
        onPointerDown={handleDown}
        onKeyDown={handleKey}
      />
      {grip && <Styles.Shield />}
    </>
  )
}
