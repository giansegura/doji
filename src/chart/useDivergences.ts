import type { IChartApi, ISeriesApi, Logical, SeriesType } from 'lightweight-charts'
import { useEffect, useMemo, useRef } from 'react'
import { rsi } from '../../shared/rsi'
import type { Bar } from '../../shared/types'
import { type Divergence, findDivergences } from '../domain/divergences'
import { type PaintedSegment, type SegmentsPrimitive, createSegmentsPrimitive } from './segmentsPrimitive'
import type { ChartHandles } from './useChart'

type UseDivergencesArgs = {
  handles: ChartHandles | null
  bars: Bar[]
  visible: boolean
  rsiLength: number
  colors: { up: string; down: string }
}

const REACH = 5

type Pane = 'price' | 'rsi'

const attach = (
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  pane: Pane,
  latest: { current: { divergences: Divergence[]; colors: { up: string; down: string } } },
): { detach: () => void; redraw: () => void } => {
  const segments = (): PaintedSegment[] =>
    latest.current.divergences.flatMap((divergence) => {
      const scale = chart.timeScale()
      const fromX = scale.logicalToCoordinate(divergence.from as Logical)
      const toX = scale.logicalToCoordinate(divergence.to as Logical)
      const fromY = series.priceToCoordinate(pane === 'price' ? divergence.priceFrom : divergence.rsiFrom)
      const toY = series.priceToCoordinate(pane === 'price' ? divergence.priceTo : divergence.rsiTo)
      if (fromX === null || toX === null || fromY === null || toY === null) return []
      const color = divergence.kind === 'bullish' ? latest.current.colors.up : latest.current.colors.down
      return [{ from: { x: fromX, y: fromY }, to: { x: toX, y: toY }, color }]
    })
  const primitive: SegmentsPrimitive = createSegmentsPrimitive({ segments })
  const redraw = () => primitive.redraw()
  series.attachPrimitive(primitive)
  chart.timeScale().subscribeVisibleLogicalRangeChange(redraw)
  return {
    redraw,
    detach: () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(redraw)
      series.detachPrimitive(primitive)
    },
  }
}

export const useDivergences = ({ handles, bars, visible, rsiLength, colors }: UseDivergencesArgs): void => {
  const divergences = useMemo(
    () => (visible ? findDivergences(bars, rsi(bars.map((bar) => bar.close), rsiLength), REACH) : []),
    [bars, visible, rsiLength],
  )
  const latest = useRef({ divergences, colors })
  const redrawRef = useRef<(() => void)[]>([])
  const main = handles?.main ?? null
  const rsiSeries = handles?.rsi ?? null
  const chart = handles?.chart ?? null

  useEffect(() => {
    latest.current = { divergences, colors }
    redrawRef.current.forEach((redraw) => redraw())
  })

  useEffect(() => {
    if (!visible || !chart) return undefined
    const attached = [main ? attach(chart, main, 'price', latest) : null, rsiSeries ? attach(chart, rsiSeries, 'rsi', latest) : null].flatMap((item) =>
      item ? [item] : [],
    )
    redrawRef.current = attached.map((item) => item.redraw)
    return () => {
      redrawRef.current = []
      if (!handles?.isAlive()) return
      try {
        attached.forEach((item) => item.detach())
      } catch {
        return
      }
    }
  }, [visible, chart, main, rsiSeries])
}
