import type { Logical } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import type { Earnings } from '../../shared/types'
import { earningsMarks } from './earningsMarks'
import { type EarningsColors, type EarningsPrimitive, createEarningsPrimitive } from './earningsPrimitive'
import type { ChartHandles } from './useChart'

type UseEarningsMarksArgs = { handles: ChartHandles | null; earnings: Earnings | null; colors: EarningsColors }

export const useEarningsMarks = ({ handles, earnings, colors }: UseEarningsMarksArgs): void => {
  const latest = useRef({ handles, earnings, colors })
  const primitiveRef = useRef<EarningsPrimitive | null>(null)
  const main = handles?.main ?? null
  const chart = handles?.chart ?? null

  useEffect(() => {
    latest.current = { handles, earnings, colors }
    primitiveRef.current?.redraw()
  })

  useEffect(() => {
    if (!main || !chart) return undefined
    const marks = () => {
      const current = latest.current
      if (!current.earnings || !current.handles) return []
      const timeScale = chart.timeScale()
      return earningsMarks(current.earnings, current.handles.timeIndex, (index) => timeScale.logicalToCoordinate(index as Logical), timeScale.width())
    }
    const primitive = createEarningsPrimitive({ marks, colors: () => latest.current.colors })
    const redraw = () => primitive.redraw()
    main.attachPrimitive(primitive)
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw)
    primitiveRef.current = primitive
    return () => {
      primitiveRef.current = null
      if (!handles?.isAlive()) return
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(redraw)
        main.detachPrimitive(primitive)
      } catch {
        return
      }
    }
  }, [main, chart])
}
