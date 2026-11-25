import type { Logical } from 'lightweight-charts'
import { useEffect, useMemo, useRef } from 'react'
import type { Bar, Indicators } from '../../shared/types'
import { findOpenGaps } from '../domain/gaps'
import { type GapBox, type GapsPrimitive, createGapsPrimitive } from './gapsPrimitive'
import type { ChartHandles } from './useChart'

type UseOpenGapsArgs = { handles: ChartHandles | null; bars: Bar[]; settings: Indicators['gaps']; colors: { up: string; down: string } }

export const useOpenGaps = ({ handles, bars, settings, colors }: UseOpenGapsArgs): void => {
  const gaps = useMemo(() => (settings.visible ? findOpenGaps(bars, settings.minPercent) : []), [bars, settings.visible, settings.minPercent])
  const latest = useRef({ gaps, colors })
  const primitiveRef = useRef<GapsPrimitive | null>(null)
  const main = handles?.main ?? null
  const chart = handles?.chart ?? null

  useEffect(() => {
    latest.current = { gaps, colors }
    primitiveRef.current?.redraw()
  })

  useEffect(() => {
    if (!settings.visible || !main || !chart) return undefined
    const boxes = (): GapBox[] =>
      latest.current.gaps.flatMap((gap) => {
        const x = chart.timeScale().logicalToCoordinate(gap.index as Logical)
        const top = main.priceToCoordinate(gap.top)
        const bottom = main.priceToCoordinate(gap.bottom)
        return x === null || top === null || bottom === null ? [] : [{ x, top, bottom, direction: gap.direction }]
      })
    const primitive = createGapsPrimitive({ boxes, colors: () => latest.current.colors })
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
  }, [settings.visible, main, chart])
}
