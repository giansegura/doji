export type Timeframe = 'D' | 'W'

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

export type SymbolList = { id: string; name: string; items: SymbolInfo[] }

export type History = {
  info: SymbolInfo
  bars: Bar[]
  splits: Split[]
  fetchedAt: string
  stale: boolean
}

export type Quote = { symbol: string; price: number; change: number; changePercent: number }

export type PaneId = 'price' | 'rsi'

export type LinePoint = { date: string; value: number }

export type TrendLine = {
  id: string
  pane: PaneId
  timeframe: Timeframe
  p1: LinePoint
  p2: LinePoint
  color: string
  width: number
  extendRight: boolean
  pricedAt: string
}

export type SmaConfig = { id: string; length: number; color: string; width: number }

export type Indicators = {
  volume: { visible: boolean }
  rsi: { visible: boolean; length: number; showMa: boolean }
  sma: SmaConfig[]
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
  lines: Record<string, TrendLine[]>
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
      name: 'Lista',
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
    rsi: { visible: true, length: 14, showMa: true },
    sma: [],
  },
  chart: { type: 'candles', scale: 'normal', invert: false, cursor: 'normal' },
  lines: {},
}
