import { useEffect, useRef } from 'react'
import type { ChartHandles } from './useChart'

export const useBackToPresent = (handles: ChartHandles | null, asOf: string | null): void => {
  const replayed = useRef(asOf !== null)

  useEffect(() => {
    if (asOf !== null) {
      replayed.current = true
      return
    }
    if (!replayed.current || !handles) return
    replayed.current = false
    handles.chart.timeScale().scrollToRealTime()
  }, [handles, asOf])
}
