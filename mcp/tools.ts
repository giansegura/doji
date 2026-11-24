import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { isSection } from '../shared/listItems'
import { SYMBOL_PATTERN } from '../shared/symbols'
import type { AppState, Quote, SymbolList, Timeframe } from '../shared/types'
import { splitBasis } from '../src/domain/splits'
import { scanRow, summarizeChart } from './chartSummary'
import type { DojiApi } from './dojiApi'
import { type Edit, addLevel, keyOf, setAlert, writeNote } from './edits'

type ServerDeps = { api: DojiApi; newId: () => string; version: string }

const INSTRUCTIONS = [
  "doji is the user's own stock charting app, running on their computer.",
  'Use these tools to read the watchlists, charts, drawings and notes of the user, and to add horizontal lines, price alerts and notes.',
  'Indicator values are computed by doji: quote them instead of estimating numbers.',
  'Prices come from Yahoo Finance and may be delayed.',
  'Whatever you add shows up in the chart of the user within a few seconds. Alerts only fire while doji is open in a browser tab.',
].join(' ')

const DEFAULT_COLOR = '#2962FF'
const DEFAULT_BARS = 60
const MAX_BARS = 300
const MAX_ATTEMPTS = 3
const SCAN_LIMIT = 40
const SCAN_BATCH = 4
const ADDED = 'Added. It shows in doji within a few seconds.'

const symbolField = z.string().trim().regex(SYMBOL_PATTERN).describe('Ticker as Yahoo Finance writes it, for example AAPL, BRK-B or ^GSPC.')
const timeframeField = z.enum(['D', 'W', 'M']).describe('D daily, W weekly, M monthly candles. Defaults to D.')

const reply = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] })

const run = async (work: () => Promise<unknown>): Promise<CallToolResult> => {
  try {
    return reply(await work())
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] }
  }
}

const describeLists = (state: AppState) => ({
  onScreen: { symbol: state.symbol, timeframe: state.timeframe },
  watchlists: state.watchlists.map((list) => ({
    id: list.id,
    name: list.name,
    active: list.id === state.activeWatchlistId,
    items: list.items.map((item) => (isSection(item) ? { section: item.title } : { symbol: item.symbol, name: item.name })),
  })),
})

const findList = (state: AppState, wanted: string | undefined): SymbolList => {
  const match = wanted?.trim().toLowerCase()
  const list = match
    ? state.watchlists.find((candidate) => candidate.id === wanted || candidate.name.toLowerCase() === match)
    : state.watchlists.find((candidate) => candidate.id === state.activeWatchlistId)
  if (list) return list
  const names = state.watchlists.map((candidate) => candidate.name).join(', ')
  throw new Error(`There is no watchlist called "${wanted}". The watchlists are: ${names}.`)
}

const quotesFor = async (api: DojiApi, symbols: string[]): Promise<Record<string, Quote>> => {
  const quotes = await api.getQuotes(symbols).catch(() => [])
  return Object.fromEntries(quotes.map((quote) => [quote.symbol.toUpperCase(), quote]))
}

const update = async <T>(api: DojiApi, change: (state: AppState) => Edit<T>): Promise<T> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const state = await api.getState()
    const edit = change(state)
    if (!edit.ok) throw new Error(edit.error)
    if (edit.state === state || (await api.saveState(edit.state)) === 'saved') return edit.detail
  }
  throw new Error('doji kept changing while saving. Try again.')
}

export const createDojiServer = ({ api, newId, version }: ServerDeps): McpServer => {
  const server = new McpServer({ name: 'doji', version }, { instructions: INSTRUCTIONS })

  const chartOf = async (state: AppState, symbol: string, timeframe: Timeframe, bars: number, quote: Quote | null) =>
    summarizeChart({
      history: await api.getHistory(symbol),
      timeframe,
      bars,
      averages: state.indicators.sma,
      drawings: state.lines[symbol] ?? [],
      note: state.notes[symbol] ?? null,
      quote,
    })

  const scan = async (wanted: string | undefined, timeframe: Timeframe) => {
    const state = await api.getState()
    const list = findList(state, wanted)
    const items = list.items.slice(0, SCAN_LIMIT)
    const symbols = items.flatMap((item) => (isSection(item) ? [] : [item.symbol]))
    const quotes = await quotesFor(api, symbols)
    const rowFor = async (symbol: string) => {
      try {
        return scanRow(await chartOf(state, symbol, timeframe, 0, quotes[symbol.toUpperCase()] ?? null))
      } catch (error) {
        return { symbol, error: error instanceof Error ? error.message : String(error) }
      }
    }
    const rows: Record<string, unknown>[] = []
    for (let start = 0; start < items.length; start += SCAN_BATCH) {
      const batch = items.slice(start, start + SCAN_BATCH)
      rows.push(...(await Promise.all(batch.map((item) => (isSection(item) ? { section: item.title } : rowFor(item.symbol))))))
    }
    return { watchlist: list.name, timeframe, rows }
  }

  server.registerTool(
    'get_watchlists',
    {
      title: 'Watchlists',
      description: 'Lists every watchlist of the user with its symbols and section titles, which one is active, and the symbol and timeframe on screen.',
      annotations: { readOnlyHint: true },
    },
    () => run(async () => describeLists(await api.getState())),
  )

  server.registerTool(
    'scan_watchlist',
    {
      title: 'Scan a watchlist',
      description:
        'Reads every symbol of a watchlist in one go: close, change, extended-hours change, RSI 14, distance to SMA 50 and SMA 200, position in the 52-week range, MACD histogram, volume against its average, armed alerts and whether it has a note. Use it to compare symbols or find the ones that meet a condition.',
      inputSchema: {
        watchlist: z.string().optional().describe('Name or id of the watchlist. Defaults to the active one.'),
        timeframe: timeframeField.optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ watchlist, timeframe }) => run(() => scan(watchlist, timeframe ?? 'D')),
  )

  server.registerTool(
    'get_chart',
    {
      title: 'Chart summary',
      description:
        'Summarizes the chart of one symbol: last price and change, extended hours, 52-week range, SMA 20/50/200 and EMA 21 plus the averages the user set, RSI 14, MACD 12/26/9, Bollinger Bands 20/2, volume, recent swing highs and lows, recent candles, the drawings of the user with their ids, and the note of the user for that symbol.',
      inputSchema: {
        symbol: symbolField,
        timeframe: timeframeField.optional(),
        bars: z.number().int().min(0).max(MAX_BARS).optional().describe(`How many recent candles to include. Defaults to ${DEFAULT_BARS}.`),
      },
      annotations: { readOnlyHint: true },
    },
    ({ symbol, timeframe, bars }) =>
      run(async () => {
        const key = keyOf(symbol)
        const [state, quotes] = await Promise.all([api.getState(), quotesFor(api, [key])])
        return chartOf(state, key, timeframe ?? 'D', bars ?? DEFAULT_BARS, quotes[key] ?? null)
      }),
  )

  server.registerTool(
    'add_horizontal_line',
    {
      title: 'Add a horizontal line',
      description:
        'Draws a horizontal line at a price on the chart of a symbol, for a support, a resistance or any level worth watching. With alert true, doji notifies the user when the price crosses it.',
      inputSchema: {
        symbol: symbolField,
        price: z.number().describe('Price of the level, in the currency of the symbol.'),
        alert: z.boolean().optional().describe('Notify the user when the price crosses the line. Defaults to false.'),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe(`Colour as #RRGGBB. Defaults to ${DEFAULT_COLOR}.`),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ symbol, price, alert, color }) =>
      run(async () => {
        const key = keyOf(symbol)
        const pricedAt = splitBasis((await api.getHistory(key)).splits)
        const id = newId()
        const line = await update(api, (state) =>
          addLevel(state, { symbol: key, price, alert: alert ?? false, color: color ?? DEFAULT_COLOR, id, pricedAt }),
        )
        return { id: line.id, symbol: key, price: line.value, alert: line.alert === true, message: ADDED }
      }),
  )

  server.registerTool(
    'set_alert',
    {
      title: 'Arm or disarm an alert',
      description:
        'Arms or disarms the price alert of an existing trend line or horizontal line of the price chart. Get the ids of the drawings with get_chart. An alert fires once when the price crosses the line, then disarms itself.',
      inputSchema: {
        symbol: symbolField,
        drawing_id: z.string().min(1).describe('Id of the drawing, as get_chart returns it.'),
        on: z.boolean().optional().describe('true arms the alert, false disarms it. Defaults to true.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ symbol, drawing_id: drawingId, on }) =>
      run(async () => {
        const drawing = await update(api, (state) => setAlert(state, { symbol, drawingId, on: on ?? true }))
        return { id: drawing.id, symbol: keyOf(symbol), alert: 'alert' in drawing && drawing.alert === true }
      }),
  )

  server.registerTool(
    'write_note',
    {
      title: 'Write in the note of a symbol',
      description:
        'Writes in the note the user keeps for a symbol: thesis, entry price, plan. By default adds the text at the end after a blank line; replace overwrites the whole note.',
      inputSchema: {
        symbol: symbolField,
        text: z.string().min(1).describe('Text to write.'),
        mode: z.enum(['append', 'replace']).optional().describe('append (default) or replace.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    ({ symbol, text, mode }) =>
      run(async () => ({ symbol: keyOf(symbol), ...(await update(api, (state) => writeNote(state, { symbol, text, mode: mode ?? 'append' }))) })),
  )

  return server
}
