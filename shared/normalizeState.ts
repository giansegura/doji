import {
  BAND_MAX_MULTIPLIER,
  BAND_MIN_MULTIPLIER,
  LIST_NAME_MAX_LENGTH,
  MAX_LISTS,
  NOTE_MAX_LENGTH,
  MAX_SMAS,
  SMA_COLORS,
  SMA_MAX_LENGTH,
  SMA_MAX_WIDTH,
  SMA_MIN_LENGTH,
  SMA_MIN_WIDTH,
} from './limits'
import { toListWidth } from './listWidth'
import {
  type AppState,
  type ChartSettings,
  DEFAULT_STATE,
  type Indicators,
  type LinePoint,
  type SmaConfig,
  type ListItem,
  type SymbolInfo,
  type SymbolList,
  type Timeframe,
  type Drawing,
  type DrawingBase,
} from './types'

type Raw = Record<string, unknown>

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
const DEFAULT_LINE_COLOR = '#2962FF'
const DEFAULT_LINE_WIDTH = 2
const NEVER_ADJUST = '9999-12-31'
const DEFAULT_LIST_ID = 'default'
const DEFAULT_LIST_NAME = 'Watchlist'

const asRecord = (value: unknown): Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : {}

const asText = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null)

const asDate = (value: unknown): string | null => (typeof value === 'string' && DATE_PATTERN.test(value) ? value : null)

const asFinite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const asBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const asTimeframe = (value: unknown): Timeframe | null => (value === 'D' || value === 'W' || value === 'M' ? value : null)

const notNull = <T>(value: T | null): value is T => value !== null

const toSymbolInfo = (raw: unknown): SymbolInfo | null => {
  const item = asRecord(raw)
  const symbol = asText(item.symbol)
  if (!symbol) return null
  return { symbol, name: asText(item.name) ?? symbol, exchange: asText(item.exchange) ?? '' }
}

const toSection = (item: Raw): ListItem | null => {
  const id = asText(item.id)
  const title = typeof item.title === 'string' ? item.title.trim().slice(0, LIST_NAME_MAX_LENGTH) : ''
  return id && title ? { kind: 'section', id, title } : null
}

const toItem = (raw: unknown): ListItem | null =>
  asRecord(raw).kind === 'section' ? toSection(asRecord(raw)) : toSymbolInfo(raw)

const toItems = (raw: unknown): ListItem[] => (Array.isArray(raw) ? raw.map(toItem).filter(notNull) : [])

const toNotes = (raw: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(asRecord(raw))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
      .map(([symbol, text]) => [symbol, text.slice(0, NOTE_MAX_LENGTH)]),
  )

const defaultLists = (): SymbolList[] =>
  DEFAULT_STATE.watchlists.map((list) => ({ ...list, items: list.items.map((item) => ({ ...item })) }))

const toList = (raw: unknown): SymbolList | null => {
  const list = asRecord(raw)
  const id = asText(list.id)
  if (!id) return null
  return { id, name: asText(typeof list.name === 'string' ? list.name.trim() : null) ?? DEFAULT_LIST_NAME, items: toItems(list.items) }
}

const toLists = (source: Raw): SymbolList[] => {
  const seen = new Set<string>()
  const lists = (Array.isArray(source.watchlists) ? source.watchlists : [])
    .map(toList)
    .filter(notNull)
    .filter((list) => !seen.has(list.id) && seen.add(list.id))
    .slice(0, MAX_LISTS)
  if (lists.length > 0) return lists
  if (Array.isArray(source.watchlist)) return [{ id: DEFAULT_LIST_ID, name: DEFAULT_LIST_NAME, items: toItems(source.watchlist) }]
  return defaultLists()
}

const toPoint = (raw: unknown): LinePoint | null => {
  const point = asRecord(raw)
  const date = asDate(point.date)
  const value = asFinite(point.value)
  return date !== null && value !== null ? { date, value } : null
}

const toWidth = (value: unknown): number => {
  const width = asFinite(value)
  return width !== null && width >= 1 && width <= 4 ? width : DEFAULT_LINE_WIDTH
}

const toBase = (item: Raw): DrawingBase | null => {
  const id = asText(item.id)
  if (!id || (item.pane !== 'price' && item.pane !== 'rsi')) return null
  return {
    id,
    pane: item.pane,
    timeframe: asTimeframe(item.timeframe) ?? 'D',
    color: asText(item.color) ?? DEFAULT_LINE_COLOR,
    width: toWidth(item.width),
    pricedAt: asDate(item.pricedAt) ?? NEVER_ADJUST,
  }
}

const toDrawing = (raw: unknown): Drawing | null => {
  const item = asRecord(raw)
  const base = toBase(item)
  const p1 = toPoint(item.p1)
  const p2 = toPoint(item.p2)
  const value = asFinite(item.value)
  const offset = asFinite(item.offset)
  if (!base) return null
  const alert = item.alert === true ? { alert: true as const } : {}
  if (item.kind === 'hline') return value === null ? null : { ...base, kind: 'hline', value, ...alert }
  if (!p1 || !p2) return null
  if (item.kind === 'channel') return offset === null ? null : { ...base, kind: 'channel', p1, p2, offset }
  if (item.kind === 'rect') return { ...base, kind: 'rect', p1, p2 }
  if (item.kind !== undefined && item.kind !== 'trend') return null
  return { ...base, p1, p2, extendRight: asBoolean(item.extendRight, false), ...alert }
}

const toLines = (raw: unknown): Record<string, Drawing[]> =>
  Object.fromEntries(
    Object.entries(asRecord(raw))
      .map(([symbol, list]): [string, Drawing[]] => [
        symbol,
        Array.isArray(list) ? list.map(toDrawing).filter(notNull) : [],
      ])
      .filter(([, list]) => list.length > 0),
  )

const toRsiLength = (value: unknown): number => {
  const length = asFinite(value)
  return length !== null && Number.isInteger(length) && length >= 2 && length <= 100
    ? length
    : DEFAULT_STATE.indicators.rsi.length
}

const toSma = (raw: unknown): SmaConfig | null => {
  const item = asRecord(raw)
  const id = asText(item.id)
  const length = asFinite(item.length)
  if (!id || length === null || !Number.isInteger(length) || length < SMA_MIN_LENGTH || length > SMA_MAX_LENGTH) {
    return null
  }
  const color = asText(item.color)
  const width = asFinite(item.width)
  return {
    id,
    length,
    color: color !== null && HEX_COLOR.test(color) ? color : SMA_COLORS[0],
    width: width !== null && Number.isInteger(width) && width >= SMA_MIN_WIDTH && width <= SMA_MAX_WIDTH ? width : SMA_MIN_WIDTH,
    ...(item.kind === 'ema' ? { kind: 'ema' as const } : {}),
  }
}

const toLength = (value: unknown, fallback: number): number => {
  const length = asFinite(value)
  return length !== null && Number.isInteger(length) && length >= SMA_MIN_LENGTH && length <= SMA_MAX_LENGTH
    ? length
    : fallback
}

const toMultiplier = (value: unknown, fallback: number): number => {
  const multiplier = asFinite(value)
  return multiplier !== null && multiplier >= BAND_MIN_MULTIPLIER && multiplier <= BAND_MAX_MULTIPLIER ? multiplier : fallback
}

const toIndicators = (raw: unknown): Indicators => {
  const indicators = asRecord(raw)
  const volume = asRecord(indicators.volume)
  const rsi = asRecord(indicators.rsi)
  const volumeMa = asRecord(indicators.volumeMa)
  const bollinger = asRecord(indicators.bollinger)
  const macd = asRecord(indicators.macd)
  const defaults = DEFAULT_STATE.indicators
  return {
    volume: { visible: asBoolean(volume.visible, defaults.volume.visible) },
    volumeMa: {
      visible: asBoolean(volumeMa.visible, defaults.volumeMa.visible),
      length: toLength(volumeMa.length, defaults.volumeMa.length),
    },
    rsi: {
      visible: asBoolean(rsi.visible, DEFAULT_STATE.indicators.rsi.visible),
      length: toRsiLength(rsi.length),
      showMa: asBoolean(rsi.showMa, DEFAULT_STATE.indicators.rsi.showMa),
    },
    sma: Array.isArray(indicators.sma) ? indicators.sma.map(toSma).filter(notNull).slice(0, MAX_SMAS) : [],
    bollinger: {
      visible: asBoolean(bollinger.visible, defaults.bollinger.visible),
      length: toLength(bollinger.length, defaults.bollinger.length),
      multiplier: toMultiplier(bollinger.multiplier, defaults.bollinger.multiplier),
    },
    macd: {
      visible: asBoolean(macd.visible, defaults.macd.visible),
      fast: toLength(macd.fast, defaults.macd.fast),
      slow: toLength(macd.slow, defaults.macd.slow),
      signal: toLength(macd.signal, defaults.macd.signal),
    },
  }
}

const CHART_TYPES: ChartSettings['type'][] = ['candles', 'bars', 'line', 'area', 'baseline']
const SCALE_MODES: ChartSettings['scale'][] = ['normal', 'log', 'percent', 'indexed']
const CURSOR_MODES: ChartSettings['cursor'][] = ['normal', 'magnet', 'magnetOhlc']

const oneOf = <T extends string>(options: T[], value: unknown, fallback: T): T =>
  options.find((option) => option === value) ?? fallback

const toChart = (raw: unknown): ChartSettings => {
  const chart = asRecord(raw)
  return {
    type: oneOf(CHART_TYPES, chart.type, DEFAULT_STATE.chart.type),
    scale: oneOf(SCALE_MODES, chart.scale, DEFAULT_STATE.chart.scale),
    invert: asBoolean(chart.invert, DEFAULT_STATE.chart.invert),
    cursor: oneOf(CURSOR_MODES, chart.cursor, DEFAULT_STATE.chart.cursor),
  }
}

export const normalizeState = (raw: unknown): AppState => {
  const source = asRecord(raw)
  const watchlists = toLists(source)
  const activeId = asText(source.activeWatchlistId)
  const rev = asFinite(source.rev)
  return {
    version: 1,
    rev: rev !== null && Number.isInteger(rev) && rev >= 1 ? rev : 1,
    theme: source.theme === 'light' || source.theme === 'dark' ? source.theme : DEFAULT_STATE.theme,
    symbol: asText(source.symbol) ?? DEFAULT_STATE.symbol,
    timeframe: asTimeframe(source.timeframe) ?? DEFAULT_STATE.timeframe,
    watchlists,
    activeWatchlistId: watchlists.some((list) => list.id === activeId) ? (activeId as string) : watchlists[0].id,
    indicators: toIndicators(source.indicators),
    chart: toChart(source.chart),
    listWidth: toListWidth(source.listWidth),
    lines: toLines(source.lines),
    notes: toNotes(source.notes),
    secondChart: asTimeframe(source.secondChart),
  }
}
