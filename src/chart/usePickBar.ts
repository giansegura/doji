import { type MouseEventParams, type Time } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import type { Bar } from '../../shared/types'
import type { ChartHandles } from './useChart'

export const barAtLogical = (bars: Pick<Bar, 'time'>[], logical: number | undefined): string | null => {
  if (logical === undefined || bars.length === 0) return null
  const index = Math.min(Math.max(Math.round(logical), 0), bars.length - 1)
  return bars[index].time
}

export const usePickBar = (handles: ChartHandles | null, bars: Pick<Bar, 'time'>[], onPickBar?: (time: string) => void): void => {
  const latest = useRef({ bars, onPickBar })
  const chart = handles?.chart ?? null
  const picking = onPickBar !== undefined

  useEffect(() => {
    latest.current = { bars, onPickBar }
  })

  useEffect(() => {
    if (!chart || !picking) return undefined
    const handleClick = (param: MouseEventParams<Time>) => {
      const time = barAtLogical(latest.current.bars, param.logical)
      if (time) latest.current.onPickBar?.(time)
    }
    chart.subscribeClick(handleClick)
    return () => {
      if (handles?.isAlive()) chart.unsubscribeClick(handleClick)
    }
  }, [chart, picking])
}
