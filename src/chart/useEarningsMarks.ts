import type { Logical } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import type { Dividend, Earnings } from '../../shared/types'
import { dividendMarks, earningsMarks } from './earningsMarks'
import { type EarningsColors, type EarningsPrimitive, createEarningsPrimitive } from './earningsPrimitive'
import type { ChartHandles } from './useChart'

type UseEarningsMarksArgs = {
  handles: ChartHandles | null
  earnings: Earnings | null
  dividends: Dividend[]
  colors: EarningsColors
}

export const useEarningsMarks = ({ handles, earnings, dividends, colors }: UseEarningsMarksArgs): void => {
  const latest = useRef({ handles, earnings, dividends, colors })
  const primitiveRef = useRef<EarningsPrimitive | null>(null)
  const main = handles?.main ?? null
  const chart = handles?.chart ?? null

  useEffect(() => {
    latest.current = { handles, earnings, dividends, colors }
    primitiveRef.current?.redraw()
  })

  useEffect(() => {
    if (!main || !chart) return undefined
    const marks = () => {
      const current = latest.current
      if (!current.handles) return []
      const timeScale = chart.timeScale()
      const toX = (index: number) => timeScale.logicalToCoordinate(index as Logical)
      const width = timeScale.width()
      const reports = current.earnings ? earningsMarks(current.earnings, current.handles.timeIndex, toX, width) : []
      return [...reports, ...dividendMarks(current.dividends, current.handles.timeIndex, toX, width, reports)]
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
