import { LIST_DEFAULT_WIDTH } from './limits'

export type Timeframe = 'D' | 'W' | 'M'

export type ThemeName = 'dark' | 'light'

export type Bar = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Split = { date: string; numerator: number; denominator: number }

export type SymbolInfo = { symbol: string; name: string; exchange: string }

export type ListSection = { kind: 'section'; id: string; title: string }

export type ListItem = SymbolInfo | ListSection

export type SymbolList = { id: string; name: string; items: ListItem[] }

export type SortColumn = 'symbol' | 'last' | 'change' | 'ext'

export type WatchlistSort = { column: SortColumn; direction: 'asc' | 'desc' }

export type History = {
  info: SymbolInfo
  bars: Bar[]
  splits: Split[]
  fetchedAt: string
  stale: boolean
}

export type ExtendedSession = 'pre' | 'post'

export type ExtendedQuote = { session: ExtendedSession; price: number; changePercent: number }

export type Quote = {
  symbol: string
  price: number
  change: number
  changePercent: number
  extended?: ExtendedQuote | null
}

export type PaneId = 'price' | 'rsi'

export type LinePoint = { date: string; value: number }

export type DrawingBase = {
  id: string
  pane: PaneId
  timeframe: Timeframe
  color: string
  width: number
  pricedAt: string
}

export type TrendLine = DrawingBase & {
  kind?: 'trend'
  p1: LinePoint
  p2: LinePoint
  extendRight: boolean
  alert?: boolean
}

export type HorizontalLine = DrawingBase & { kind: 'hline'; value: number; alert?: boolean }

export type Channel = DrawingBase & { kind: 'channel'; p1: LinePoint; p2: LinePoint; offset: number }

export type Rectangle = DrawingBase & { kind: 'rect'; p1: LinePoint; p2: LinePoint }

export type Drawing = TrendLine | HorizontalLine | Channel | Rectangle

export type SmaConfig = { id: string; length: number; color: string; width: number; kind?: 'ema' }

export type Indicators = {
  volume: { visible: boolean }
  volumeMa: { visible: boolean; length: number }
  rsi: { visible: boolean; length: number; showMa: boolean }
  sma: SmaConfig[]
  bollinger: { visible: boolean; length: number; multiplier: number }
  macd: { visible: boolean; fast: number; slow: number; signal: number }
}

export type ChartType = 'candles' | 'bars' | 'line' | 'area' | 'baseline'

export type ScaleMode = 'normal' | 'log' | 'percent' | 'indexed'

export type CursorMode = 'normal' | 'magnet' | 'magnetOhlc'

export type ChartSettings = { type: ChartType; scale: ScaleMode; invert: boolean; cursor: CursorMode }

export type AppState = {
  version: 1
  rev: number
  theme: ThemeName
  symbol: string
  timeframe: Timeframe
  watchlists: SymbolList[]
  activeWatchlistId: string
  indicators: Indicators
  chart: ChartSettings
  listWidth: number
  lines: Record<string, Drawing[]>
  notes: Record<string, string>
  secondChart: Timeframe | null
  watchlistSort: WatchlistSort | null
}

export const DEFAULT_STATE: AppState = {
  version: 1,
  rev: 1,
  theme: 'dark',
  symbol: 'AAPL',
  timeframe: 'D',
  watchlists: [
    {
      id: 'default',
      name: 'Watchlist',
      items: [
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
    { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca' },
      ],
    },
  ],
  activeWatchlistId: 'default',
  indicators: {
    volume: { visible: true },
    volumeMa: { visible: false, length: 20 },
    rsi: { visible: true, length: 14, showMa: true },
    sma: [],
    bollinger: { visible: false, length: 20, multiplier: 2 },
    macd: { visible: false, fast: 12, slow: 26, signal: 9 },
  },
  chart: { type: 'candles', scale: 'normal', invert: false, cursor: 'normal' },
  listWidth: LIST_DEFAULT_WIDTH,
  lines: {},
  notes: {},
  secondChart: null,
  watchlistSort: null,
}
