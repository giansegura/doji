import {
  AreaSeries,
  type AutoscaleInfo,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  LineSeries,
  LineStyle,
  type LineWidth,
  type MouseEventParams,
  PriceScaleMode,
  type SeriesType,
  type Time,
  createChart,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChartSettings,
  ChartType,
  CursorMode,
  History,
  Indicators,
  ScaleMode,
  SmaConfig,
  Timeframe,
} from '../../shared/types'
import type { Theme } from '../theme/tokens'
import { createBandPrimitive } from './bandPrimitive'
import { type HoverStore, createHoverStore } from './hoverStore'
import { type SeriesData, buildSeriesData } from './seriesData'
import { type TimeIndex, createTimeIndex } from './timeIndex'
import { initialRange, rangeAfterTimeframeChange } from './visibleRange'

export type ChartHandles = {
  chart: IChartApi
  main: ISeriesApi<SeriesType>
  rsi: ISeriesApi<'Line'> | null
  timeIndex: TimeIndex
  container: HTMLDivElement
  isAlive: () => boolean
}

type Main = {
  type: ChartType
  series: ISeriesApi<SeriesType>
  update: (data: SeriesData, theme: Theme) => void
}

type SeriesSet = {
  main: Main
  volume: ISeriesApi<'Histogram'> | null
  rsi: ISeriesApi<'Line'> | null
  rsiMa: ISeriesApi<'Line'> | null
  smas: Map<string, ISeriesApi<'Line'>>
}

type View = { symbol: string; timeframe: Timeframe; count: number; timeIndex: TimeIndex | null }

type UseChartArgs = {
  history: History
  timeframe: Timeframe
  theme: Theme
  indicators: Indicators
  settings: ChartSettings
}

const RSI_UPPER = 70
const RSI_MIDDLE = 50
const RSI_LOWER = 30
const PRICE_PANE_STRETCH = 3
const RSI_PANE_STRETCH = 1
const SEPARATOR_PX = 1
const RIGHT_OFFSET_BARS = 10
const MAIN_LINE_WIDTH = 2
const AREA_TOP = 'rgba(41, 98, 255, 0.28)'
const AREA_BOTTOM = 'rgba(41, 98, 255, 0.04)'
const UP_FILL_STRONG = 'rgba(8, 153, 129, 0.28)'
const UP_FILL_SOFT = 'rgba(8, 153, 129, 0.04)'
const DOWN_FILL_STRONG = 'rgba(242, 54, 69, 0.28)'
const DOWN_FILL_SOFT = 'rgba(242, 54, 69, 0.04)'

const SCALE_MODES: Record<ScaleMode, PriceScaleMode> = {
  normal: PriceScaleMode.Normal,
  log: PriceScaleMode.Logarithmic,
  percent: PriceScaleMode.Percentage,
  indexed: PriceScaleMode.IndexedTo100,
}

const CURSOR_MODES: Record<CursorMode, CrosshairMode> = {
  normal: CrosshairMode.Normal,
  magnet: CrosshairMode.Magnet,
  magnetOhlc: CrosshairMode.MagnetOHLC,
}

const chartOptions = (theme: Theme, cursor: CursorMode) => ({
  layout: {
    background: { type: ColorType.Solid as const, color: theme.chart.bg },
    textColor: theme.chart.text,
    fontFamily: theme.ui.font,
    fontSize: 12,
    attributionLogo: true,
    panes: { enableResize: true, separatorColor: theme.chart.border, separatorHoverColor: theme.ui.hover },
  },
  grid: { vertLines: { color: theme.chart.grid }, horzLines: { color: theme.chart.grid } },
  crosshair: {
    mode: CURSOR_MODES[cursor],
    vertLine: { color: theme.chart.crosshair, labelBackgroundColor: theme.chart.crosshairLabel },
    horzLine: { color: theme.chart.crosshair, labelBackgroundColor: theme.chart.crosshairLabel },
  },
  rightPriceScale: { borderColor: theme.chart.border },
  timeScale: { borderColor: theme.chart.border },
})

const candleOptions = (theme: Theme) => ({
  upColor: theme.chart.up,
  downColor: theme.chart.down,
  borderUpColor: theme.chart.up,
  borderDownColor: theme.chart.down,
  wickUpColor: theme.chart.up,
  wickDownColor: theme.chart.down,
})

const previousClose = (data: SeriesData): number => data.bars.at(-2)?.close ?? data.bars.at(-1)?.close ?? 0

const MAIN_FACTORIES: Record<ChartType, (chart: IChartApi) => Main> = {
  candles: (chart) => {
    const series = chart.addSeries(CandlestickSeries, {}, 0)
    return {
      type: 'candles',
      series,
      update: (data, theme) => {
        series.applyOptions(candleOptions(theme))
        series.setData(data.candles)
      },
    }
  },
  bars: (chart) => {
    const series = chart.addSeries(BarSeries, {}, 0)
    return {
      type: 'bars',
      series,
      update: (data, theme) => {
        series.applyOptions({ upColor: theme.chart.up, downColor: theme.chart.down })
        series.setData(data.candles)
      },
    }
  },
  line: (chart) => {
    const series = chart.addSeries(LineSeries, {}, 0)
    return {
      type: 'line',
      series,
      update: (data, theme) => {
        series.applyOptions({ color: theme.chart.line, lineWidth: MAIN_LINE_WIDTH })
        series.setData(data.closes)
      },
    }
  },
  area: (chart) => {
    const series = chart.addSeries(AreaSeries, {}, 0)
    return {
      type: 'area',
      series,
      update: (data, theme) => {
        series.applyOptions({
          lineColor: theme.chart.line,
          lineWidth: MAIN_LINE_WIDTH,
          topColor: AREA_TOP,
          bottomColor: AREA_BOTTOM,
        })
        series.setData(data.closes)
      },
    }
  },
  baseline: (chart) => {
    const series = chart.addSeries(BaselineSeries, {}, 0)
    return {
      type: 'baseline',
      series,
      update: (data, theme) => {
        series.applyOptions({
          baseValue: { type: 'price', price: previousClose(data) },
          lineWidth: MAIN_LINE_WIDTH,
          topLineColor: theme.chart.up,
          topFillColor1: UP_FILL_STRONG,
          topFillColor2: UP_FILL_SOFT,
          bottomLineColor: theme.chart.down,
          bottomFillColor1: DOWN_FILL_SOFT,
          bottomFillColor2: DOWN_FILL_STRONG,
        })
        series.setData(data.closes)
      },
    }
  },
}

const syncMain = (chart: IChartApi, series: SeriesSet, type: ChartType): void => {
  if (series.main.type === type) return
  chart.removeSeries(series.main.series)
  series.main = MAIN_FACTORIES[type](chart)
  series.main.series.setSeriesOrder(series.volume ? 1 : 0)
}

const rsiAutoscale = (original: () => AutoscaleInfo | null): AutoscaleInfo | null => {
  const info = original()
  if (!info?.priceRange) return info
  return {
    ...info,
    priceRange: {
      minValue: Math.min(info.priceRange.minValue, RSI_LOWER),
      maxValue: Math.max(info.priceRange.maxValue, RSI_UPPER),
    },
  }
}

const addVolume = (chart: IChartApi): ISeriesApi<'Histogram'> => {
  const volume = chart.addSeries(
    HistogramSeries,
    { priceFormat: { type: 'volume' }, priceScaleId: '', priceLineVisible: false, lastValueVisible: false },
    0,
  )
  volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } })
  volume.setSeriesOrder(0)
  return volume
}

const addRsi = (chart: IChartApi, theme: Theme): ISeriesApi<'Line'> => {
  const rsi = chart.addSeries(
    LineSeries,
    {
      color: theme.chart.rsi,
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: rsiAutoscale,
    },
    1,
  )
  ;[RSI_UPPER, RSI_MIDDLE, RSI_LOWER].forEach((price) =>
    rsi.createPriceLine({
      price,
      color: theme.chart.rsiLevel,
      lineWidth: 1,
      lineStyle: price === RSI_MIDDLE ? LineStyle.Dotted : LineStyle.Dashed,
      axisLabelVisible: false,
    }),
  )
  rsi.attachPrimitive(createBandPrimitive(RSI_UPPER, RSI_LOWER, theme.chart.rsiBand))
  const [pricePane, rsiPane] = chart.panes()
  pricePane?.setStretchFactor(PRICE_PANE_STRETCH)
  rsiPane?.setStretchFactor(RSI_PANE_STRETCH)
  return rsi
}

const addRsiMa = (chart: IChartApi, theme: Theme): ISeriesApi<'Line'> =>
  chart.addSeries(
    LineSeries,
    {
      color: theme.chart.rsiMa,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    },
    1,
  )

const smaOptions = (config: SmaConfig) => ({
  color: config.color,
  lineWidth: config.width as LineWidth,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: false,
})

const syncSmas = (chart: IChartApi, series: SeriesSet, configs: SmaConfig[]): void => {
  ;[...series.smas.keys()]
    .filter((id) => !configs.some((config) => config.id === id))
    .forEach((id) => {
      const removed = series.smas.get(id)
      if (removed) chart.removeSeries(removed)
      series.smas.delete(id)
    })
  configs.forEach((config) => {
    const existing = series.smas.get(config.id)
    if (existing) existing.applyOptions(smaOptions(config))
    else series.smas.set(config.id, chart.addSeries(LineSeries, smaOptions(config), 0))
  })
}

const syncIndicators = (chart: IChartApi, series: SeriesSet, indicators: Indicators, theme: Theme): void => {
  syncSmas(chart, series, indicators.sma)
  if (indicators.volume.visible && !series.volume) series.volume = addVolume(chart)
  if (!indicators.volume.visible && series.volume) {
    chart.removeSeries(series.volume)
    series.volume = null
  }
  if (indicators.rsi.visible && !series.rsi) series.rsi = addRsi(chart, theme)
  if (series.rsi && indicators.rsi.showMa && !series.rsiMa) series.rsiMa = addRsiMa(chart, theme)
  if (series.rsiMa && (!indicators.rsi.showMa || !indicators.rsi.visible)) {
    chart.removeSeries(series.rsiMa)
    series.rsiMa = null
  }
  if (!indicators.rsi.visible && series.rsi) {
    chart.removeSeries(series.rsi)
    series.rsi = null
  }
}

export const useChart = ({ history, timeframe, theme, indicators, settings }: UseChartArgs) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<SeriesSet | null>(null)
  const viewRef = useRef<View | null>(null)
  const scaleRef = useRef<ScaleMode>('normal')
  const [handles, setHandles] = useState<ChartHandles | null>(null)
  const [rsiPaneTop, setRsiPaneTop] = useState<number | null>(null)
  const [hover] = useState<HoverStore>(createHoverStore)
  const symbol = history.info.symbol
  const volumeVisible = indicators.volume.visible
  const rsiVisible = indicators.rsi.visible
  const rsiMaVisible = indicators.rsi.showMa
  const rsiLength = indicators.rsi.length
  const smaConfigs = indicators.sma
  const smaKey = smaConfigs.map((item) => `${item.id}:${item.length}:${item.color}:${item.width}`).join('|')
  const smaLengthsKey = smaConfigs.map((item) => item.length).join(',')
  const chartType = settings.type
  const scaleMode = settings.scale
  const invertScale = settings.invert
  const cursorMode = settings.cursor

  const data = useMemo(
    () =>
      buildSeriesData(
        history.bars,
        timeframe,
        rsiLength,
        { volumeUp: theme.chart.volumeUp, volumeDown: theme.chart.volumeDown },
        smaLengthsKey ? smaLengthsKey.split(',').map(Number) : [],
      ),
    [history.bars, timeframe, rsiLength, theme, smaLengthsKey],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const chart = createChart(container, { autoSize: true, timeScale: { rightOffset: RIGHT_OFFSET_BARS } })
    const measure = () => setRsiPaneTop(seriesRef.current?.rsi ? chart.paneSize(0).height + SEPARATOR_PX : null)
    const handleMove = (param: MouseEventParams<Time>) => {
      measure()
      hover.set(param.point && param.logical !== undefined ? Math.round(param.logical) : null)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    chart.subscribeCrosshairMove(handleMove)
    chartRef.current = chart
    seriesRef.current = { main: MAIN_FACTORIES.candles(chart), volume: null, rsi: null, rsiMa: null, smas: new Map() }
    return () => {
      observer.disconnect()
      chart.unsubscribeCrosshairMove(handleMove)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      viewRef.current = null
      scaleRef.current = 'normal'
      setHandles(null)
    }
  }, [hover])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    const container = containerRef.current
    if (!chart || !series || !container) return undefined

    const previous = viewRef.current
    const previousRange = chart.timeScale().getVisibleLogicalRange()

    chart.applyOptions(chartOptions(theme, cursorMode))
    chart.priceScale('right', 0).applyOptions({
      scaleMargins: { top: 0.1, bottom: volumeVisible ? 0.25 : 0.1 },
      invertScale: invertScale,
    })
    if (scaleRef.current !== scaleMode) {
      chart.priceScale('right', 0).applyOptions({ mode: SCALE_MODES[scaleMode] })
      scaleRef.current = scaleMode
    }
    syncIndicators(
      chart,
      series,
      {
        volume: { visible: volumeVisible },
        rsi: { visible: rsiVisible, length: rsiLength, showMa: rsiMaVisible },
        sma: smaConfigs,
      },
      theme,
    )

    syncMain(chart, series, chartType)
    series.main.update(data, theme)
    series.volume?.setData(data.volume)
    series.rsi?.setData(data.rsi)
    series.rsiMa?.setData(data.rsiMa)
    smaConfigs.forEach((config, index) => series.smas.get(config.id)?.setData(data.smas[index] ?? []))
    if (previous && (previous.symbol !== symbol || previous.timeframe !== timeframe)) hover.set(null)

    const count = data.bars.length
    const timeIndex = count > 0 ? createTimeIndex(data.bars.map((bar) => bar.time), timeframe) : null
    const next = { count, timeIndex }
    if (timeIndex && (!previous || previous.symbol !== symbol)) {
      chart.timeScale().setVisibleLogicalRange(initialRange(count))
    } else if (timeIndex && previous?.timeIndex && previousRange && previous.timeframe !== timeframe) {
      chart.timeScale().setVisibleLogicalRange(
        rangeAfterTimeframeChange(
          { count: previous.count, timeIndex: previous.timeIndex, range: previousRange },
          { count: next.count, timeIndex },
        ),
      )
    }
    viewRef.current = { symbol, timeframe, ...next }
    setHandles(
      timeIndex
        ? {
            chart,
            main: series.main.series,
            rsi: series.rsi,
            timeIndex,
            container,
            isAlive: () => chartRef.current === chart,
          }
        : null,
    )

    const frame = requestAnimationFrame(() =>
      setRsiPaneTop(series.rsi ? chart.paneSize(0).height + SEPARATOR_PX : null),
    )
    return () => cancelAnimationFrame(frame)
  }, [
    hover,
    data,
    symbol,
    timeframe,
    theme,
    volumeVisible,
    rsiVisible,
    rsiMaVisible,
    rsiLength,
    smaKey,
    chartType,
    scaleMode,
    invertScale,
    cursorMode,
  ])

  return { containerRef, handles, data, rsiPaneTop, hover }
}
