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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Bar,
  ChartSettings,
  ChartType,
  CursorMode,
  History,
  Indicators,
  ScaleMode,
  SmaConfig,
  Timeframe,
} from '../../shared/types'
import { type LivePrice, withLivePrice } from '../domain/liveBar'
import { withAlpha } from '../theme/alpha'
import type { Theme } from '../theme/tokens'
import { formatWithPrecision, priceFormatOf } from './priceFormat'
import { type PriceRange, type ViewStore, captureView, restoreView, sharedViewStore } from './savedViews'
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
  tick: (data: SeriesData) => void
}

type BandSeries = { basis: ISeriesApi<'Line'>; upper: ISeriesApi<'Line'>; lower: ISeriesApi<'Line'> }

type MacdSeries = { histogram: ISeriesApi<'Histogram'>; line: ISeriesApi<'Line'>; signal: ISeriesApi<'Line'> }

type SeriesSet = {
  main: Main
  volume: ISeriesApi<'Histogram'> | null
  volumeMa: ISeriesApi<'Line'> | null
  rsi: ISeriesApi<'Line'> | null
  rsiMa: ISeriesApi<'Line'> | null
  smas: Map<string, ISeriesApi<'Line'>>
  bands: BandSeries | null
  macd: MacdSeries | null
}

type PaneTops = { rsi: number | null; macd: number | null }

type View = { symbol: string; timeframe: Timeframe; count: number; timeIndex: TimeIndex | null }

type UseChartArgs = {
  history: History
  timeframe: Timeframe
  theme: Theme
  indicators: Indicators
  settings: ChartSettings
  live?: LivePrice | null
  viewId?: string
  views?: ViewStore
}

const RSI_UPPER = 70
const RSI_MIDDLE = 50
const RSI_LOWER = 30
const PRICE_PANE_STRETCH = 3
const RSI_PANE_STRETCH = 1
const VOLUME_SCALE = 'volume'
const NO_PANES: PaneTops = { rsi: null, macd: null }
const SEPARATOR_PX = 1
const RIGHT_OFFSET_BARS = 10
const MAIN_LINE_WIDTH = 2
const FILL_STRONG = 0.28
const FILL_SOFT = 0.04

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

const withLast = <T>(points: T[] | undefined, apply: (point: T) => void): void => {
  const point = points?.at(-1)
  if (point) apply(point)
}

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
      tick: (data) => withLast(data.candles, (candle) => series.update(candle)),
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
      tick: (data) => withLast(data.candles, (candle) => series.update(candle)),
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
      tick: (data) => withLast(data.closes, (close) => series.update(close)),
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
          topColor: withAlpha(theme.chart.line, FILL_STRONG),
          bottomColor: withAlpha(theme.chart.line, FILL_SOFT),
        })
        series.setData(data.closes)
      },
      tick: (data) => withLast(data.closes, (close) => series.update(close)),
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
          topFillColor1: withAlpha(theme.chart.up, FILL_STRONG),
          topFillColor2: withAlpha(theme.chart.up, FILL_SOFT),
          bottomLineColor: theme.chart.down,
          bottomFillColor1: withAlpha(theme.chart.down, FILL_SOFT),
          bottomFillColor2: withAlpha(theme.chart.down, FILL_STRONG),
        })
        series.setData(data.closes)
      },
      tick: (data) => withLast(data.closes, (close) => series.update(close)),
    }
  },
}

const tickSeries = (series: SeriesSet, data: SeriesData, smaConfigs: SmaConfig[]): void => {
  series.main.tick(data)
  withLast(data.volume, (point) => series.volume?.update(point))
  withLast(data.volumeMa, (point) => series.volumeMa?.update(point))
  withLast(data.rsi, (point) => series.rsi?.update(point))
  withLast(data.rsiMa, (point) => series.rsiMa?.update(point))
  withLast(data.bands?.basis, (point) => series.bands?.basis.update(point))
  withLast(data.bands?.upper, (point) => series.bands?.upper.update(point))
  withLast(data.bands?.lower, (point) => series.bands?.lower.update(point))
  withLast(data.macd?.histogram, (point) => series.macd?.histogram.update(point))
  withLast(data.macd?.line, (point) => series.macd?.line.update(point))
  withLast(data.macd?.signal, (point) => series.macd?.signal.update(point))
  smaConfigs.forEach((config, index) => withLast(data.smas[index], (point) => series.smas.get(config.id)?.update(point)))
}

const manualPriceRange = (series: SeriesSet): PriceRange | null => {
  const scale = series.main.series.priceScale()
  return scale.options().autoScale ? null : scale.getVisibleRange()
}

const applyPriceRange = (series: SeriesSet, range: PriceRange | null): void => {
  const scale = series.main.series.priceScale()
  series.rsi?.priceScale().applyOptions({ autoScale: true })
  if (!range) {
    scale.applyOptions({ autoScale: true })
    return
  }
  scale.applyOptions({ autoScale: false })
  scale.setVisibleRange(range)
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
    { priceFormat: { type: 'volume' }, priceScaleId: VOLUME_SCALE, priceLineVisible: false, lastValueVisible: false },
    0,
  )
  volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } })
  volume.setSeriesOrder(0)
  return volume
}

const quietLine = (color: string) => ({
  color,
  lineWidth: 1 as LineWidth,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: false,
})

const addVolumeMa = (chart: IChartApi, theme: Theme): ISeriesApi<'Line'> =>
  chart.addSeries(
    LineSeries,
    { ...quietLine(theme.chart.volumeMa), priceFormat: { type: 'volume' }, priceScaleId: VOLUME_SCALE },
    0,
  )

const addBands = (chart: IChartApi, theme: Theme): BandSeries => ({
  basis: chart.addSeries(LineSeries, quietLine(theme.chart.bandBasis), 0),
  upper: chart.addSeries(LineSeries, quietLine(theme.chart.band), 0),
  lower: chart.addSeries(LineSeries, quietLine(theme.chart.band), 0),
})

const addMacd = (chart: IChartApi, theme: Theme, paneIndex: number): MacdSeries => ({
  histogram: chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, paneIndex),
  line: chart.addSeries(LineSeries, quietLine(theme.chart.macd), paneIndex),
  signal: chart.addSeries(LineSeries, quietLine(theme.chart.macdSignal), paneIndex),
})

const paneTops = (chart: IChartApi, series: SeriesSet | null): PaneTops => {
  if (!series) return NO_PANES
  const heights = chart.panes().map((_, index) => chart.paneSize(index).height + SEPARATOR_PX)
  const below = (count: number): number => heights.slice(0, count).reduce((sum, height) => sum + height, 0)
  return { rsi: series.rsi ? below(1) : null, macd: series.macd ? below(series.rsi ? 2 : 1) : null }
}

const addRsi = (chart: IChartApi, theme: Theme, paneIndex: number): ISeriesApi<'Line'> => {
  const rsi = chart.addSeries(
    LineSeries,
    {
      color: theme.chart.rsi,
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: rsiAutoscale,
    },
    paneIndex,
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
  return rsi
}

const addRsiMa = (chart: IChartApi, theme: Theme, paneIndex: number): ISeriesApi<'Line'> =>
  chart.addSeries(
    LineSeries,
    {
      color: theme.chart.rsiMa,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    },
    paneIndex,
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

const syncIndicators = (chart: IChartApi, series: SeriesSet, indicators: Omit<Indicators, 'volumeProfile' | 'levels'>, theme: Theme): void => {
  const panesBefore = chart.panes().length
  syncSmas(chart, series, indicators.sma)
  if (indicators.volume.visible && !series.volume) series.volume = addVolume(chart)
  if (!indicators.volume.visible && series.volume) {
    chart.removeSeries(series.volume)
    series.volume = null
  }
  const wantsVolumeMa = indicators.volume.visible && indicators.volumeMa.visible
  if (wantsVolumeMa && !series.volumeMa) series.volumeMa = addVolumeMa(chart, theme)
  if (!wantsVolumeMa && series.volumeMa) {
    chart.removeSeries(series.volumeMa)
    series.volumeMa = null
  }
  if (indicators.bollinger.visible && !series.bands) series.bands = addBands(chart, theme)
  if (!indicators.bollinger.visible && series.bands) {
    Object.values(series.bands).forEach((line) => chart.removeSeries(line))
    series.bands = null
  }
  if (!indicators.macd.visible && series.macd) {
    Object.values(series.macd).forEach((item) => chart.removeSeries(item))
    series.macd = null
  }
  if (indicators.rsi.visible && !series.rsi) {
    series.rsi = addRsi(chart, theme, series.macd ? 2 : 1)
    if (series.macd) series.rsi.getPane().moveTo(1)
  }
  if (series.rsi && indicators.rsi.showMa && !series.rsiMa) {
    series.rsiMa = addRsiMa(chart, theme, series.rsi.getPane().paneIndex())
  }
  if (series.rsiMa && (!indicators.rsi.showMa || !indicators.rsi.visible)) {
    chart.removeSeries(series.rsiMa)
    series.rsiMa = null
  }
  if (!indicators.rsi.visible && series.rsi) {
    chart.removeSeries(series.rsi)
    series.rsi = null
  }
  if (indicators.macd.visible && !series.macd) series.macd = addMacd(chart, theme, series.rsi ? 2 : 1)
  if (chart.panes().length === panesBefore) return
  chart.panes().forEach((pane, index) => pane.setStretchFactor(index === 0 ? PRICE_PANE_STRETCH : RSI_PANE_STRETCH))
}

export const useChart = ({
  history,
  timeframe,
  theme,
  indicators,
  settings,
  live = null,
  viewId = 'main',
  views = sharedViewStore,
}: UseChartArgs) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<SeriesSet | null>(null)
  const viewRef = useRef<View | null>(null)
  const scaleRef = useRef<ScaleMode>('normal')
  const [handles, setHandles] = useState<ChartHandles | null>(null)
  const [tops, setTops] = useState<PaneTops>(NO_PANES)
  const [hover] = useState<HoverStore>(createHoverStore)
  const symbol = history.info.symbol
  const volumeVisible = indicators.volume.visible
  const rsiVisible = indicators.rsi.visible
  const rsiMaVisible = indicators.rsi.showMa
  const rsiLength = indicators.rsi.length
  const smaConfigs = indicators.sma
  const smaKey = smaConfigs.map((item) => `${item.id}:${item.length}:${item.color}:${item.width}`).join('|')
  const averagesKey = smaConfigs.map((item) => `${item.kind ?? 'sma'}:${item.length}`).join(',')
  const volumeMaVisible = volumeVisible && indicators.volumeMa.visible
  const volumeMaLength = indicators.volumeMa.length
  const bandsVisible = indicators.bollinger.visible
  const bandsLength = indicators.bollinger.length
  const bandsMultiplier = indicators.bollinger.multiplier
  const macdVisible = indicators.macd.visible
  const macdFast = indicators.macd.fast
  const macdSlow = indicators.macd.slow
  const macdSignal = indicators.macd.signal
  const chartType = settings.type
  const scaleMode = settings.scale
  const invertScale = settings.invert
  const cursorMode = settings.cursor

  const build = useCallback(
    (bars: Bar[]) =>
      buildSeriesData(
        bars,
        timeframe,
        rsiLength,
        { volumeUp: theme.chart.volumeUp, volumeDown: theme.chart.volumeDown, up: theme.chart.up, down: theme.chart.down },
        averagesKey
          ? averagesKey.split(',').map((entry) => {
              const [kind, length] = entry.split(':')
              return kind === 'ema' ? { length: Number(length), kind: 'ema' as const } : { length: Number(length) }
            })
          : [],
        {
          volumeMa: volumeMaVisible ? volumeMaLength : undefined,
          bollinger: bandsVisible ? { length: bandsLength, multiplier: bandsMultiplier } : undefined,
          macd: macdVisible ? { fast: macdFast, slow: macdSlow, signal: macdSignal } : undefined,
        },
      ),
    [
      timeframe,
      rsiLength,
      theme,
      averagesKey,
      volumeMaVisible,
      volumeMaLength,
      bandsVisible,
      bandsLength,
      bandsMultiplier,
      macdVisible,
      macdFast,
      macdSlow,
      macdSignal,
    ],
  )
  const baseData = useMemo(() => build(history.bars), [build, history.bars])
  const liveBars = useMemo(
    () => withLivePrice(history, live),
    [history, live?.symbol, live?.price, live?.time, live?.day, live?.volume, live?.high, live?.low],
  )
  const data = useMemo(
    () => (liveBars === history.bars ? baseData : build(liveBars)),
    [build, baseData, liveBars, history.bars],
  )
  const dataRef = useRef(data)

  useEffect(() => {
    const save = (): void => {
      const chart = chartRef.current
      const series = seriesRef.current
      const view = viewRef.current
      const range = chart?.timeScale().getVisibleLogicalRange()
      if (chart && series && view?.timeIndex && range) {
        views.set(`${viewId}:${view.symbol}`, captureView(range, view.timeIndex, view.timeframe, manualPriceRange(series)))
      }
    }
    window.addEventListener('pagehide', save)
    return () => {
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [viewId, views])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const chart = createChart(container, { autoSize: true, timeScale: { rightOffset: RIGHT_OFFSET_BARS } })
    const measure = () =>
      setTops((current) => {
        const next = paneTops(chart, seriesRef.current)
        return next.rsi === current.rsi && next.macd === current.macd ? current : next
      })
    const handleMove = (param: MouseEventParams<Time>) => {
      measure()
      hover.set(param.point && param.logical !== undefined ? Math.round(param.logical) : null)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    chart.subscribeCrosshairMove(handleMove)
    chartRef.current = chart
    seriesRef.current = {
      main: MAIN_FACTORIES.candles(chart),
      volume: null,
      volumeMa: null,
      rsi: null,
      rsiMa: null,
      smas: new Map(),
      bands: null,
      macd: null,
    }
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
    dataRef.current = data
  }, [data])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    const container = containerRef.current
    if (!chart || !series || !container) return undefined

    const data = dataRef.current
    const previous = viewRef.current
    const previousRange = chart.timeScale().getVisibleLogicalRange()
    if (previous?.timeIndex && previousRange && previous.symbol !== symbol) {
      views.set(`${viewId}:${previous.symbol}`, captureView(previousRange, previous.timeIndex, previous.timeframe, manualPriceRange(series)))
    }

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
        volumeMa: { visible: volumeMaVisible, length: volumeMaLength },
        rsi: { visible: rsiVisible, length: rsiLength, showMa: rsiMaVisible },
        sma: smaConfigs,
        bollinger: { visible: bandsVisible, length: bandsLength, multiplier: bandsMultiplier },
        macd: { visible: macdVisible, fast: macdFast, slow: macdSlow, signal: macdSignal },
      },
      theme,
    )

    syncMain(chart, series, chartType)
    series.main.update(data, theme)
    series.main.series.applyOptions({ priceFormat: priceFormatOf(symbol, data.bars.at(-1)?.close ?? 0) })
    series.volume?.setData(data.volume)
    series.rsi?.setData(data.rsi)
    series.rsiMa?.setData(data.rsiMa)
    series.volumeMa?.setData(data.volumeMa)
    series.bands?.basis.setData(data.bands?.basis ?? [])
    series.bands?.upper.setData(data.bands?.upper ?? [])
    series.bands?.lower.setData(data.bands?.lower ?? [])
    series.macd?.histogram.setData(data.macd?.histogram ?? [])
    series.macd?.line.setData(data.macd?.line ?? [])
    series.macd?.signal.setData(data.macd?.signal ?? [])
    smaConfigs.forEach((config, index) => series.smas.get(config.id)?.setData(data.smas[index] ?? []))
    if (previous && (previous.symbol !== symbol || previous.timeframe !== timeframe)) hover.set(null)

    const count = data.bars.length
    const timeIndex = count > 0 ? createTimeIndex(data.bars.map((bar) => bar.time), timeframe) : null
    const next = { count, timeIndex }
    if (timeIndex && (!previous || previous.symbol !== symbol)) {
      const saved = views.get(`${viewId}:${symbol}`)
      chart.timeScale().setVisibleLogicalRange(saved ? restoreView(saved, timeIndex, timeframe) : initialRange(count))
      applyPriceRange(series, saved?.timeframe === timeframe ? saved.price : null)
    } else if (timeIndex && previous?.timeIndex && previousRange && previous.timeframe !== timeframe) {
      chart.timeScale().setVisibleLogicalRange(
        rangeAfterTimeframeChange(
          { count: previous.count, timeIndex: previous.timeIndex, range: previousRange },
          { count: next.count, timeIndex },
        ),
      )
      applyPriceRange(series, null)
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

    const frame = requestAnimationFrame(() => setTops(paneTops(chart, series)))
    return () => cancelAnimationFrame(frame)
  }, [
    hover,
    baseData,
    symbol,
    timeframe,
    theme,
    volumeVisible,
    rsiVisible,
    rsiMaVisible,
    rsiLength,
    smaKey,
    volumeMaVisible,
    volumeMaLength,
    bandsVisible,
    bandsLength,
    bandsMultiplier,
    macdVisible,
    macdFast,
    macdSlow,
    macdSignal,
    chartType,
    scaleMode,
    invertScale,
    cursorMode,
  ])

  useEffect(() => {
    if (seriesRef.current) tickSeries(seriesRef.current, data, smaConfigs)
  }, [data])

  const livePrecision = priceFormatOf(symbol, data.bars.at(-1)?.close ?? 0).precision

  useEffect(() => {
    seriesRef.current?.main.series.applyOptions({ priceFormat: formatWithPrecision(livePrecision) })
  }, [livePrecision])

  return { containerRef, handles, data, rsiPaneTop: tops.rsi, macdPaneTop: tops.macd, hover }
}
