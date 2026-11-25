import { LIST_DEFAULT_WIDTH } from './limits'

export type Timeframe = 'D' | 'W' | 'M'

export type ThemeName = 'doji' | 'midnight' | 'light'

export type Bar = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Split = { date: string; numerator: number; denominator: number }

export type Dividend = { date: string; amount: number }

export type SymbolInfo = { symbol: string; name: string; exchange: string }

export type ListSection = { kind: 'section'; id: string; title: string }

export type ListItem = SymbolInfo | ListSection

export type SymbolList = { id: string; name: string; items: ListItem[]; icon?: string }

export type WatchColumn = 'rsi' | 'fromHigh' | 'relVolume' | 'earnings' | 'level' | 'gain' | 'gainValue'

export type Holding = { quantity: number; price: number }

export type FlagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'

export type FilterField = 'change' | 'rsi' | 'fromHigh' | 'relVolume' | 'level' | 'vsSma50' | 'vsSma200' | 'earningsDays'

export type FilterCondition = { field: FilterField; op: 'above' | 'below'; value: number }

export type SavedFilter = { id: string; name: string; scope: 'list' | 'all'; conditions: FilterCondition[] }

export type SortColumn = 'symbol' | 'last' | 'change' | 'ext' | 'flag' | WatchColumn

export type WatchlistSort = { column: SortColumn; direction: 'asc' | 'desc' }

export type History = {
  info: SymbolInfo
  bars: Bar[]
  splits: Split[]
  dividends?: Dividend[]
  fetchedAt: string
  stale: boolean
  tradedAt?: number
  currency?: string
  timezone?: string
}

export type CompanyProfile = {
  kind: string | null
  name: string | null
  currency: string | null
  marketCap: number | null
  totalAssets: number | null
  trailingPE: number | null
  forwardPE: number | null
  dividendYield: number | null
  beta: number | null
  high52: number | null
  low52: number | null
  sector: string | null
  industry: string | null
  category: string | null
  country: string | null
  employees: number | null
  website: string | null
  summary: string | null
}

export type NewsItem = { id: string; title: string; publisher: string; time: number; url: string }

export type ExtendedSession = 'pre' | 'post'

export type ExtendedQuote = { session: ExtendedSession; price: number; changePercent: number }

export type Quote = {
  symbol: string
  price: number
  change: number
  changePercent: number
  extended?: ExtendedQuote | null
  time?: number
  timezone?: string
  volume?: number
  currency?: string
}

export type TickSession = ExtendedSession | 'regular'

export type LiveTick = {
  symbol: string
  price: number
  change: number
  changePercent: number
  time: number
  session: TickSession
  volume: number | null
}

export type PaneId = 'price' | 'rsi'

export type LinePoint = { date: string; value: number }

export type LineStyle = 'solid' | 'dashed' | 'dotted'

export type DrawingBase = {
  id: string
  pane: PaneId
  timeframe: Timeframe
  color: string
  width: number
  pricedAt: string
  lineStyle?: Exclude<LineStyle, 'solid'>
  opacity?: number
  by?: 'ai'
  currency?: 'EUR'
  hidden?: true
}

export type TrendLine = DrawingBase & {
  kind?: 'trend'
  p1: LinePoint
  p2: LinePoint
  extendRight: boolean
  alert?: boolean
  text?: string
  arrow?: true
}

export type HorizontalLine = DrawingBase & { kind: 'hline'; value: number; alert?: boolean; hidePrice?: true; text?: string; from?: string }

export type VerticalLine = DrawingBase & { kind: 'vline'; date: string; text?: string }

export type PriceZone = DrawingBase & { kind: 'zone'; top: number; bottom: number; text?: string }

export type TextNote = DrawingBase & { kind: 'note'; p1: LinePoint; text: string }

export type Channel = DrawingBase & { kind: 'channel'; p1: LinePoint; p2: LinePoint; offset: number }

export type Rectangle = DrawingBase & { kind: 'rect'; p1: LinePoint; p2: LinePoint }

export type PositionSide = 'long' | 'short'

export type Position = DrawingBase & {
  kind: 'position'
  side: PositionSide
  p1: LinePoint
  p2: LinePoint
  stop: number
  target: number
  alert?: boolean
  account?: number
  riskPercent?: number
}

export type Drawing = TrendLine | HorizontalLine | Channel | Rectangle | Position | VerticalLine | PriceZone | TextNote

export type AlertEvent = {
  id: string
  symbol: string
  level: number
  price: number
  direction: 'up' | 'down'
  at: string
  text: string | null
  label?: string
}

export type EarningsTiming = 'pre' | 'post'

export type EarningsResult = { actual: number; estimate: number | null }

export type Earnings = {
  past: string[]
  next: string | null
  nextIsEstimate: boolean
  timing?: Record<string, EarningsTiming>
  results?: Record<string, EarningsResult>
  nextEstimate?: number
}

export type DrawingKind = 'trend' | 'hline' | 'channel' | 'rect' | 'position' | 'vline' | 'zone' | 'note'

export type LineLook = Pick<DrawingBase, 'color' | 'width' | 'lineStyle' | 'opacity'> & { hidePrice?: true }

export type SmaConfig = { id: string; length: number; color: string; width: number; kind?: 'ema' }

export type PatternKind = 'doji' | 'hammer' | 'shootingStar' | 'bullishEngulfing' | 'bearishEngulfing'

export type IndicatorAlertKind = 'rsi' | 'average' | 'move'

export type IndicatorAlert = { id: string; kind: IndicatorAlertKind; value: number; averageId?: string; armed: boolean }

export type Indicators = {
  volume: { visible: boolean }
  volumeMa: { visible: boolean; length: number }
  rsi: { visible: boolean; length: number; showMa: boolean }
  sma: SmaConfig[]
  bollinger: { visible: boolean; length: number; multiplier: number }
  macd: { visible: boolean; fast: number; slow: number; signal: number }
  volumeProfile: { visible: boolean; rows: number }
  levels: { visible: boolean; perSide: number }
  marks: { earnings: boolean; dividends: boolean }
  patterns: { visible: boolean; kinds: PatternKind[] }
}

export type ChartType = 'candles' | 'bars' | 'line' | 'area' | 'baseline'

export type ScaleMode = 'normal' | 'log' | 'percent' | 'indexed'

export type CursorMode = 'normal' | 'magnet' | 'magnetOhlc'

export type ChartCurrency = 'original' | 'EUR'

export type ChartSettings = { type: ChartType; scale: ScaleMode; invert: boolean; cursor: CursorMode; currency: ChartCurrency }

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
  watchlistColumns: WatchColumn[]
  flags: Record<string, FlagColor>
  onlyFlagged: boolean
  filters: SavedFilter[]
  activeFilterId: string | null
  holdings: Record<string, Holding>
  shareHoldings: boolean
  indicatorAlerts: Record<string, IndicatorAlert[]>
  drawingsHidden: boolean
  drawingsLocked: boolean
  lineLooks: Partial<Record<DrawingKind, LineLook>>
  earningsBadge: boolean
}

export const DEFAULT_STATE: AppState = {
  version: 1,
  rev: 1,
  theme: 'doji',
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
    volumeProfile: { visible: false, rows: 24 },
    levels: { visible: false, perSide: 3 },
    marks: { earnings: true, dividends: true },
    patterns: { visible: false, kinds: ['doji', 'hammer', 'shootingStar', 'bullishEngulfing', 'bearishEngulfing'] },
  },
  chart: { type: 'candles', scale: 'normal', invert: false, cursor: 'normal', currency: 'original' },
  listWidth: LIST_DEFAULT_WIDTH,
  lines: {},
  notes: {},
  secondChart: null,
  watchlistSort: null,
  watchlistColumns: [],
  flags: {},
  onlyFlagged: false,
  filters: [],
  activeFilterId: null,
  holdings: {},
  shareHoldings: false,
  indicatorAlerts: {},
  drawingsHidden: false,
  drawingsLocked: false,
  lineLooks: {},
  earningsBadge: false,
}
