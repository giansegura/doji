import { useEffect, useRef } from 'react'
import type { Bar, Indicators } from '../../shared/types'
import type { ChartHandles } from './useChart'
import { type Profile, volumeProfile } from './volumeProfile'
import { type ProfileColors, type VolumeProfilePrimitive, createVolumeProfilePrimitive } from './volumeProfilePrimitive'

type UseVolumeProfileArgs = {
  handles: ChartHandles | null
  bars: Bar[]
  settings: Indicators['volumeProfile']
  colors: ProfileColors
}

export const visibleBars = (bars: Bar[], range: { from: number; to: number } | null): Bar[] => {
  if (!range) return []
  return bars.slice(Math.max(Math.ceil(range.from), 0), Math.max(Math.floor(range.to) + 1, 0))
}

export const createProfileMemo = () => {
  let cache: { bars: Bar[] | null; key: string; profile: Profile | null } = { bars: null, key: '', profile: null }
  return (bars: Bar[], range: { from: number; to: number } | null, rows: number): Profile | null => {
    const shown = visibleBars(bars, range)
    const key = `${shown.length}:${shown[0]?.time}:${shown.at(-1)?.time}:${rows}`
    if (bars !== cache.bars || key !== cache.key) {
      cache = { bars, key, profile: volumeProfile(shown.map((bar) => ({ ...bar, volume: bar.volume ?? 0 })), rows) }
    }
    return cache.profile
  }
}

export const useVolumeProfile = ({ handles, bars, settings, colors }: UseVolumeProfileArgs): void => {
  const latest = useRef({ bars, rows: settings.rows, colors })
  const primitiveRef = useRef<VolumeProfilePrimitive | null>(null)
  const main = handles?.main ?? null
  const chart = handles?.chart ?? null

  useEffect(() => {
    latest.current = { bars, rows: settings.rows, colors }
    primitiveRef.current?.redraw()
  })

  useEffect(() => {
    if (!settings.visible || !main || !chart) return undefined
    const memo = createProfileMemo()
    const profile = (): Profile | null => memo(latest.current.bars, chart.timeScale().getVisibleLogicalRange(), latest.current.rows)
    const primitive = createVolumeProfilePrimitive({ profile, colors: () => latest.current.colors })
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
