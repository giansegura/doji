import { type ISeriesMarkersPluginApi, type Time, createSeriesMarkers } from 'lightweight-charts'
import { useEffect, useMemo, useRef } from 'react'
import type { Bar, Indicators } from '../../shared/types'
import { findPatterns } from '../domain/patterns'
import { patternMarkers } from './patternMarkers'
import type { ChartHandles } from './useChart'

type Colors = { up: string; down: string; neutral: string }

type UsePatternMarkersArgs = { handles: ChartHandles | null; bars: Bar[]; settings: Indicators['patterns']; colors: Colors }

export const usePatternMarkers = ({ handles, bars, settings, colors }: UsePatternMarkersArgs): void => {
  const pluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const main = handles?.main ?? null
  const markers = useMemo(
    () => (settings.visible ? patternMarkers(findPatterns(bars, settings.kinds), bars, colors) : []),
    [bars, settings.visible, settings.kinds, colors.up, colors.down, colors.neutral],
  )

  useEffect(() => {
    if (!main) return undefined
    const plugin = createSeriesMarkers(main, [])
    pluginRef.current = plugin
    return () => {
      pluginRef.current = null
      if (!handles?.isAlive()) return
      try {
        plugin.detach()
      } catch {
        return
      }
    }
  }, [main])

  useEffect(() => {
    pluginRef.current?.setMarkers(markers)
  }, [markers, main])
}
