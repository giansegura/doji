import { useEffect, useRef, useState } from 'react'
import type { PaneId } from '../../shared/types'
import { type FittedScale, createAutoFit } from './autoFit'
import type { ChartHandles } from './useChart'

const PANES: PaneId[] = ['price', 'rsi']

const scaleOf = (handles: ChartHandles | null, pane: PaneId): FittedScale | null => {
  const series = pane === 'price' ? handles?.main : handles?.rsi
  if (!handles?.isAlive() || !series) return null
  try {
    const scale = series.priceScale()
    return {
      isAuto: () => scale.options().autoScale,
      setAuto: (auto) => scale.applyOptions({ autoScale: auto }),
    }
  } catch {
    return null
  }
}

export const useAutoFit = (handles: ChartHandles | null, symbol: string) => {
  const [manual, setManual] = useState(false)
  const latest = useRef(handles)
  const [autoFit] = useState(() =>
    createAutoFit({ panes: PANES, scale: (pane) => scaleOf(latest.current, pane), onChange: setManual }),
  )

  useEffect(() => {
    latest.current = handles
    autoFit.sync()
  }, [autoFit, handles])

  useEffect(() => {
    autoFit.sync()
  }, [autoFit, symbol])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const syncLater = () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(autoFit.sync, 0)
    }
    window.addEventListener('pointerup', syncLater)
    window.addEventListener('dblclick', syncLater)
    return () => {
      window.removeEventListener('pointerup', syncLater)
      window.removeEventListener('dblclick', syncLater)
      if (timer !== null) clearTimeout(timer)
    }
  }, [autoFit])

  return { manual, release: autoFit.release, fit: autoFit.fit }
}
