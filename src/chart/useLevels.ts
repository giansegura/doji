import { useEffect, useMemo, useRef } from 'react'
import { supportsAndResistances } from '../../shared/levels'
import type { Drawing, History, Indicators } from '../../shared/types'
import { type LevelsPrimitive, createLevelsPrimitive, levelsToShow } from './levelsPrimitive'
import type { ChartHandles } from './useChart'

type UseLevelsArgs = {
  handles: ChartHandles | null
  history: History
  settings: Indicators['levels']
  lines: Drawing[]
  color: string
}

const NONE: number[] = []

export const useLevels = ({ handles, history, settings, lines, color }: UseLevelsArgs): number[] => {
  const computed = useMemo(
    () => (settings.visible ? supportsAndResistances(history.info.symbol, history.bars, settings.perSide) : null),
    [history, settings.visible, settings.perSide],
  )
  const prices = useMemo(
    () =>
      computed
        ? levelsToShow(
            [...computed.resistances, ...computed.supports].map((level) => level.price),
            lines,
            computed.tolerance,
          )
        : NONE,
    [computed, lines],
  )
  const latest = useRef({ prices, color })
  const primitiveRef = useRef<LevelsPrimitive | null>(null)
  const main = handles?.main ?? null

  useEffect(() => {
    latest.current = { prices, color }
    primitiveRef.current?.redraw()
  })

  useEffect(() => {
    if (!settings.visible || !main) return undefined
    const primitive = createLevelsPrimitive({ prices: () => latest.current.prices, color: () => latest.current.color })
    main.attachPrimitive(primitive)
    primitiveRef.current = primitive
    return () => {
      primitiveRef.current = null
      if (!handles?.isAlive()) return
      try {
        main.detachPrimitive(primitive)
      } catch {
        return
      }
    }
  }, [settings.visible, main])

  return prices
}
