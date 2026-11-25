import { type CreatePriceLineOptions, type IPriceLine, LineStyle } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import type { Holding } from '../../shared/types'
import { formatMoney, holdingGain } from '../domain/holdings'
import { formatPercent } from './format'
import type { ChartHandles } from './useChart'

type Colors = { up: string; down: string }

type UsePositionLineArgs = {
  handles: ChartHandles | null
  holding: Holding | undefined
  price: number | null
  currency: string | undefined
  colors: Colors
}

export const positionLineOptions = (holding: Holding, price: number | null, currency: string | undefined, colors: Colors): CreatePriceLineOptions => {
  const gain = price === null ? null : holdingGain(holding, price)
  return {
    price: holding.price,
    color: gain && gain.value < 0 ? colors.down : colors.up,
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: true,
    title: gain ? `${formatPercent(gain.percent)} ${formatMoney(gain.value, currency)}` : `${holding.quantity} shares`,
  }
}

export const usePositionLine = ({ handles, holding, price, currency, colors }: UsePositionLineArgs): void => {
  const lineRef = useRef<IPriceLine | null>(null)
  const latest = useRef({ price, currency, colors })
  const main = handles?.main ?? null
  const quantity = holding?.quantity ?? null
  const average = holding?.price ?? null

  useEffect(() => {
    latest.current = { price, currency, colors }
    if (lineRef.current && holding) lineRef.current.applyOptions(positionLineOptions(holding, price, currency, colors))
  })

  useEffect(() => {
    if (!main || quantity === null || average === null) return undefined
    const { price: last, currency: unit, colors: tones } = latest.current
    const line = main.createPriceLine(positionLineOptions({ quantity, price: average }, last, unit, tones))
    lineRef.current = line
    return () => {
      lineRef.current = null
      if (!handles?.isAlive()) return
      try {
        main.removePriceLine(line)
      } catch {
        return
      }
    }
  }, [main, quantity, average])
}
