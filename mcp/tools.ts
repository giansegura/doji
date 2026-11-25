import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { holdingGain } from '../src/domain/holdings'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { isSection } from '../shared/listItems'
import { SYMBOL_PATTERN } from '../shared/symbols'
import type { AppState, Quote, SymbolInfo, SymbolList, Timeframe } from '../shared/types'
import { addDays, todayIso } from '../shared/dates'
import { calendarEntries, calendarItems } from '../src/domain/earningsCalendar'
import { splitBasis } from '../src/domain/splits'
import { scanRow, summarizeChart } from './chartSummary'
import { type DojiApi, isMissingSymbol } from './dojiApi'
import {
  type Edit,
  addLevel,
  addSectionTo,
  addSymbols,
  addTrend,
  createList,
  deleteDrawing,
  keyOf,
  removeSymbols,
  renameList,
  setAlert,
  setListIcon,
  updateDrawing,
  writeNote,
} from './edits'

type ServerDeps = { api: DojiApi; newId: () => string; version: string; today?: () => string }

const INSTRUCTIONS = [
  "doji is the user's own stock charting app, running on their computer.",
  'Use these tools to read the watchlists, charts, earnings dates, news, company sheets, drawings and notes of the user, to draw horizontal and trend lines, to move, restyle or label drawings, and to set price alerts and notes.',
  'Indicator values are computed by doji: quote them instead of estimating numbers.',
  'Prices come from Yahoo Finance and may be delayed.',
  'You can also create watchlists, add or remove their symbols, add sections and rename them, but not delete a watchlist. You can delete only the drawings you made yourself (get_chart marks them with madeByAi).',
  'Whatever you change shows up in doji within a few seconds. Alerts fire while the doji server is running, even with no browser tab open, and also arrive by Telegram when the user linked a bot.',
].join(' ')

const DEFAULT_COLOR = '#2962FF'
const DEFAULT_BARS = 60
const MAX_BARS = 300
const MAX_ATTEMPTS = 3
const SCAN_BATCH = 4
const MAX_SYMBOLS_PER_CALL = 50
const LIST_NAME_LIMIT = 40
const ADDED = 'Added. It shows in doji within a few seconds.'
const CHANGED = 'Changed. It shows in doji within a few seconds.'
const DELETED = 'Deleted.'
const CALENDAR_DAYS = 7
const TIMING_WORDS = { pre: 'before the opening', post: 'after the close' } as const
const isCalendarDay = (text: string): boolean => {
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDay, 'Not a day of the calendar.')

const symbolField = z.string().trim().regex(SYMBOL_PATTERN).describe('Ticker as Yahoo Finance writes it, for example AAPL, BRK-B or ^GSPC.')
const timeframeField = z.enum(['D', 'W', 'M']).describe('D daily, W weekly, M monthly candles. Defaults to D.')

const symbolsField = z.array(symbolField).min(1).max(MAX_SYMBOLS_PER_CALL)
const iconField = z.string().max(16).describe('An emoji shown before the name of the watchlist, such as 🏦 or 🚀.')
const watchlistField = z.string().optional().describe('Name or id of the watchlist. Defaults to the active one.')
const pointField = z.object({
  date: dateField.describe('Day of the candle, as YYYY-MM-DD.'),
  price: z.number().describe('Price at that day, in the currency of the symbol.'),
})
const colorField = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
const textField = z.string().max(60).describe('Short label written on the line, such as "R1" or "weekly support".')

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
    icon: list.icon ?? null,
    active: list.id === state.activeWatchlistId,
    items: list.items.map((item) => {
      if (isSection(item)) return { section: item.title }
      const flag = state.flags[item.symbol]
      return { symbol: item.symbol, name: item.name, ...(flag ? { flag } : {}) }
    }),
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

const roundMoney = (value: number): number => Number(value.toFixed(2))

const sharedPosition = (state: AppState, symbol: string, close: number | null) => {
  const holding = state.holdings[symbol]
  if (!state.shareHoldings || !holding || close === null) return null
  const gain = holdingGain(holding, close)
  return { shares: holding.quantity, averagePrice: holding.price, gainPercent: roundMoney(gain.percent), gain: roundMoney(gain.value) }
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

export const createDojiServer = ({ api, newId, version, today = todayIso }: ServerDeps): McpServer => {
  const server = new McpServer({ name: 'doji', version }, { instructions: INSTRUCTIONS })

  const chartOf = async (state: AppState, symbol: string, timeframe: Timeframe, bars: number, quote: Quote | null) => {
    const summary = summarizeChart({
      history: await api.getHistory(symbol),
      timeframe,
      bars,
      averages: state.indicators.sma,
      drawings: state.lines[symbol] ?? [],
      note: state.notes[symbol] ?? null,
      quote,
    })
    const position = sharedPosition(state, symbol, summary.price.close)
    return position ? { ...summary, position } : summary
  }

  const scan = async (wanted: string | undefined, timeframe: Timeframe) => {
    const state = await api.getState()
    const list = findList(state, wanted)
    const { items } = list
    const symbols = items.flatMap((item) => (isSection(item) ? [] : [item.symbol]))
    const quotes = await quotesFor(api, symbols)
    const rowFor = async (symbol: string) => {
      try {
        const flag = state.flags[symbol]
        const chart = await chartOf(state, symbol, timeframe, 0, quotes[symbol.toUpperCase()] ?? null)
        const gain = 'position' in chart ? { positionGainPercent: chart.position.gainPercent } : {}
        return { ...scanRow(chart), ...(flag ? { flag } : {}), ...gain }
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
      description:
        'Lists every watchlist of the user with its symbols and section titles, the colour flag of each flagged symbol (a flag belongs to the symbol, so it is the same in every list), which one is active, and the symbol and timeframe on screen.',
      annotations: { readOnlyHint: true },
    },
    () => run(async () => describeLists(await api.getState())),
  )

  server.registerTool(
    'scan_watchlist',
    {
      title: 'Scan a watchlist',
      description:
        'Reads every symbol of a watchlist in one go: close, change, extended-hours change, RSI 14, distance to SMA 50 and SMA 200, position in the 52-week range and distance below its high, MACD histogram, volume against its average, armed alerts, whether it has a note, the distance to the nearest support and resistance, the colour flag when the user flagged it, and the gain of the position when the user shares positions with the AI. Use it to compare symbols or find the ones that meet a condition.',
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
        'Summarizes the chart of one symbol: last price and change, extended hours, 52-week range, SMA 20/50/200 and EMA 21 plus the averages the user set, RSI 14, MACD 12/26/9, Bollinger Bands 20/2, volume, recent swing highs and lows, the support and resistance levels around the price (found by doji from the weekly turns and how often the price bounced there), the last four dividends with their ex-dates and the dividend yield of the last twelve months, recent candles, the drawings of the user with their ids, the note of the user for that symbol, the past and next earnings dates and, only if the user chose to share positions with the AI, the position held (shares, average price and gain).',
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
        const [chart, earnings] = await Promise.all([chartOf(state, key, timeframe ?? 'D', bars ?? DEFAULT_BARS, quotes[key] ?? null), api.getEarnings(key)])
        return { ...chart, earnings }
      }),
  )

  server.registerTool(
    'get_earnings_calendar',
    {
      title: 'Earnings calendar',
      description:
        'Lists the earnings reports of the symbols in the watchlists between two dates: the past ones and the next one of each company, with whether they come before the opening or after the close when known, and whether the date is only an estimate. Defaults to the next seven days across every watchlist.',
      inputSchema: {
        watchlist: watchlistField,
        from: dateField.optional().describe('First day, as YYYY-MM-DD. Defaults to today.'),
        to: dateField.optional().describe('Last day, as YYYY-MM-DD. Defaults to seven days after the first.'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ watchlist, from, to }) =>
      run(async () => {
        const state = await api.getState()
        const lists = watchlist ? [findList(state, watchlist)] : state.watchlists
        const items = calendarItems(lists)
        const first = from ?? today()
        const last = to ?? addDays(first, CALENDAR_DAYS)
        const { earnings, pending } = await api.getEarningsCalendar(items.map((item) => item.symbol))
        const nameOf = (id: string) => state.watchlists.find((list) => list.id === id)?.name ?? id
        const entries = calendarEntries(calendarItems(state.watchlists).filter((item) => items.some((kept) => kept.symbol === item.symbol)), earnings)
          .filter((entry) => entry.date >= first && entry.date <= last)
          .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))
          .map((entry) => ({
            date: entry.date,
            symbol: entry.symbol,
            name: entry.name,
            watchlists: entry.lists.map(nameOf),
            kind: entry.kind,
            estimatedDate: entry.estimate,
            timing: entry.timing ? TIMING_WORDS[entry.timing] : null,
          }))
        const message = pending > 0 ? { message: `doji is still fetching ${pending} earnings dates. Ask again in a minute for the full list.` } : {}
        return { from: first, to: last, entries, stillLoading: pending, ...message }
      }),
  )

  server.registerTool(
    'get_company_profile',
    {
      title: 'Company sheet',
      description:
        'Gives the sheet of a company or fund from Yahoo Finance: name, kind (stock or ETF), currency, market cap or total assets, trailing and forward P/E, dividend yield as a fraction, beta, 52-week high and low, sector and industry (or category for funds), country, employees, website and a short description.',
      inputSchema: { symbol: symbolField },
      annotations: { readOnlyHint: true },
    },
    ({ symbol }) =>
      run(async () => {
        const key = keyOf(symbol)
        return { symbol: key, ...(await api.getProfile(key)) }
      }),
  )

  server.registerTool(
    'get_news',
    {
      title: 'News headlines',
      description:
        'Gives the latest news headlines about a symbol from Yahoo Finance, newest first: title, publisher, time and link. Only headlines: doji does not copy the articles, so open the link to read one.',
      inputSchema: { symbol: symbolField },
      annotations: { readOnlyHint: true },
    },
    ({ symbol }) =>
      run(async () => {
        const key = keyOf(symbol)
        const news = await api.getNews(key)
        return {
          symbol: key,
          headlines: news.map((item) => ({ title: item.title, publisher: item.publisher, time: new Date(item.time).toISOString(), url: item.url })),
        }
      }),
  )

  server.registerTool(
    'get_earnings',
    {
      title: 'Earnings dates',
      description:
        'Gives the last reported earnings dates of a symbol and the next one, saying whether Yahoo only estimates the next date, with the actual and the expected earnings per share of each recent report (results, by date) and the expected earnings per share of the next one (nextEstimate).',
      inputSchema: { symbol: symbolField },
      annotations: { readOnlyHint: true },
    },
    ({ symbol }) =>
      run(async () => {
        const key = keyOf(symbol)
        return { symbol: key, ...(await api.getEarnings(key)) }
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
    'add_trend_line',
    {
      title: 'Add a trend line',
      description:
        'Draws a trend line on the price chart of a symbol between two points, each a day and a price, for a rising support, a falling resistance or a channel edge. extend_right carries it past the second point. With alert true, doji notifies the user when the price crosses it.',
      inputSchema: {
        symbol: symbolField,
        from: pointField.describe('First point of the line.'),
        to: pointField.describe('Second point, on a later day.'),
        extend_right: z.boolean().optional().describe('Carry the line on past the second point. Defaults to false.'),
        alert: z.boolean().optional().describe('Notify the user when the price crosses the line. Defaults to false.'),
        color: colorField.optional().describe(`Colour as #RRGGBB. Defaults to ${DEFAULT_COLOR}.`),
        text: textField.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ symbol, from, to, extend_right: extendRight, alert, color, text }) =>
      run(async () => {
        const key = keyOf(symbol)
        const pricedAt = splitBasis((await api.getHistory(key)).splits)
        const id = newId()
        const line = await update(api, (state) =>
          addTrend(state, {
            symbol: key,
            from,
            to,
            extendRight: extendRight ?? false,
            alert: alert ?? false,
            color: color ?? DEFAULT_COLOR,
            text: text ?? null,
            id,
            pricedAt,
          }),
        )
        return {
          id: line.id,
          symbol: key,
          from: { date: line.p1.date, price: line.p1.value },
          to: { date: line.p2.date, price: line.p2.value },
          extendRight: line.extendRight,
          alert: line.alert === true,
          message: ADDED,
        }
      }),
  )

  server.registerTool(
    'set_alert',
    {
      title: 'Arm or disarm an alert',
      description:
        'Arms or disarms the price alert of an existing trend line, horizontal line or position of the price chart. Get the ids of the drawings with get_chart. An alert fires when the price crosses the line, or the stop or target of a position, then disarms itself, unless the user set it to repeat (alertRepeats in get_chart: it stays armed and fires at most once a day). alertUntil is the last day it stays armed.',
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
    'update_drawing',
    {
      title: 'Move or restyle a drawing',
      description:
        'Changes an existing drawing of a symbol: the price of a horizontal line, the two points of a trend line, channel or rectangle, whether a trend line extends to the right, its colour, width (1 to 4), line style (solid, dashed or dotted), opacity (0.1 to 1) or its text (an empty text removes it). Get the ids of the drawings with get_chart. Only what is given changes.',
      inputSchema: {
        symbol: symbolField,
        drawing_id: z.string().min(1).describe('Id of the drawing, as get_chart returns it.'),
        price: z.number().optional().describe('New price of a horizontal line.'),
        from: pointField.optional().describe('New first point of a trend line, channel or rectangle.'),
        to: pointField.optional().describe('New second point of a trend line, channel or rectangle.'),
        extend_right: z.boolean().optional().describe('Carry a trend line on past its second point, or stop it there.'),
        color: colorField.optional().describe('Colour as #RRGGBB.'),
        width: z.number().int().min(1).max(4).optional(),
        line_style: z.enum(['solid', 'dashed', 'dotted']).optional(),
        opacity: z.number().min(0.1).max(1).optional(),
        text: z.string().max(60).optional().describe('Label of a trend or horizontal line. An empty text removes it.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ symbol, drawing_id: drawingId, price, from, to, extend_right: extendRight, color, width, line_style: lineStyle, opacity, text }) =>
      run(async () => {
        const key = keyOf(symbol)
        const { splits } = await api.getHistory(key)
        const drawing = await update(api, (state) =>
          updateDrawing(state, { symbol: key, drawingId, price, from, to, extendRight, color, width, lineStyle, opacity, text, splits }),
        )
        return { id: drawing.id, symbol: key, message: CHANGED }
      }),
  )

  server.registerTool(
    'delete_drawing',
    {
      title: 'Delete a drawing made by the AI',
      description:
        'Deletes a drawing that an AI made earlier (get_chart marks those with madeByAi). Drawings made by the user cannot be deleted from here; ask the user to delete them in doji.',
      inputSchema: {
        symbol: symbolField,
        drawing_id: z.string().min(1).describe('Id of the drawing, as get_chart returns it.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    ({ symbol, drawing_id: drawingId }) =>
      run(async () => {
        const key = keyOf(symbol)
        const removed = await update(api, (state) => deleteDrawing(state, { symbol: key, drawingId }))
        return { id: removed.id, symbol: key, message: DELETED }
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

  const resolve = async (symbols: string[]): Promise<{ found: SymbolInfo[]; notFound: string[] }> => {
    const wanted = [...new Set(symbols.map(keyOf))]
    const results: (SymbolInfo | null)[] = []
    for (let start = 0; start < wanted.length; start += SCAN_BATCH) {
      const batch = wanted.slice(start, start + SCAN_BATCH)
      results.push(
        ...(await Promise.all(
          batch.map((symbol) =>
            api.getHistory(symbol).then(
              (history) => history.info,
              (error: unknown) => {
                if (isMissingSymbol(error)) return null
                throw error
              },
            ),
          ),
        )),
      )
    }
    return {
      found: results.filter((info): info is SymbolInfo => info !== null),
      notFound: wanted.filter((_, index) => results[index] === null),
    }
  }

  const pickList = async (wanted: string | undefined): Promise<SymbolList> => findList(await api.getState(), wanted)

  const changeList = async <T>(picked: SymbolList, change: (state: AppState, list: SymbolList) => Edit<T>) =>
    update(api, (state): Edit<T> => {
      const list = state.watchlists.find((candidate) => candidate.id === picked.id)
      return list ? change(state, list) : { ok: false, error: `${picked.name} was deleted while saving. Nothing was changed.` }
    })

  server.registerTool(
    'create_watchlist',
    {
      title: 'Create a watchlist',
      description:
        'Creates a new watchlist, optionally with symbols. It does not switch the watchlist on screen. Symbols doji has no data for are left out and reported.',
      inputSchema: {
        name: z.string().min(1).max(LIST_NAME_LIMIT).describe('Name of the new watchlist.'),
        symbols: symbolsField.optional().describe('Tickers to put in it, as Yahoo Finance writes them.'),
        icon: iconField.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ name, symbols, icon }) =>
      run(async () => {
        await api.getState()
        const { found, notFound } = await resolve(symbols ?? [])
        const id = newId()
        return { ...(await update(api, (state) => createList(state, { id, name, symbols: found, icon }))), notFound }
      }),
  )

  server.registerTool(
    'add_to_watchlist',
    {
      title: 'Add symbols to a watchlist',
      description:
        'Adds symbols at the end of a watchlist, or at the end of one of its sections. Symbols already in it are skipped, and symbols doji has no data for are reported.',
      inputSchema: {
        watchlist: watchlistField,
        symbols: symbolsField.describe('Tickers to add, as Yahoo Finance writes them.'),
        section: z.string().optional().describe('Title of the section to add them to. Defaults to the end of the watchlist.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ watchlist, symbols, section }) =>
      run(async () => {
        const picked = await pickList(watchlist)
        const { found, notFound } = await resolve(symbols)
        let name = ''
        const detail = await changeList(picked, (state, list) => {
          name = list.name
          return addSymbols(state, { listId: list.id, symbols: found, section: section ?? null })
        })
        return { watchlist: name, ...detail, notFound }
      }),
  )

  server.registerTool(
    'add_section',
    {
      title: 'Add a section to a watchlist',
      description: 'Adds a section title at the end of a watchlist, to group the symbols added after it.',
      inputSchema: {
        watchlist: watchlistField,
        title: z.string().min(1).max(LIST_NAME_LIMIT).describe('Title of the section.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ watchlist, title }) =>
      run(async () => {
        const picked = await pickList(watchlist)
        const id = newId()
        let name = ''
        const detail = await changeList(picked, (state, list) => {
          name = list.name
          return addSectionTo(state, { listId: list.id, id, title })
        })
        return { watchlist: name, ...detail }
      }),
  )

  server.registerTool(
    'remove_from_watchlist',
    {
      title: 'Remove symbols from a watchlist',
      description: 'Removes symbols from a watchlist. Their drawings, alerts and notes stay. Reports the ones that were not in it.',
      inputSchema: {
        watchlist: watchlistField,
        symbols: symbolsField.describe('Tickers to remove.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ watchlist, symbols }) =>
      run(async () => {
        const picked = await pickList(watchlist)
        let name = ''
        const detail = await changeList(picked, (state, list) => {
          name = list.name
          return removeSymbols(state, { listId: list.id, symbols })
        })
        return { watchlist: name, ...detail }
      }),
  )

  server.registerTool(
    'rename_watchlist',
    {
      title: 'Rename a watchlist',
      description: 'Changes the name of a watchlist. The new name must not belong to another watchlist.',
      inputSchema: {
        watchlist: watchlistField,
        name: z.string().min(1).max(LIST_NAME_LIMIT).describe('New name.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ watchlist, name }) =>
      run(async () => changeList(await pickList(watchlist), (state, list) => renameList(state, { listId: list.id, name }))),
  )

  server.registerTool(
    'set_watchlist_icon',
    {
      title: 'Set the icon of a watchlist',
      description: 'Puts an emoji before the name of a watchlist, or takes it away with an empty text. Only the first emoji is kept.',
      inputSchema: {
        watchlist: watchlistField,
        icon: z.string().max(16).describe('An emoji such as 🏦 or 🚀, or an empty text to remove the icon.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ watchlist, icon }) =>
      run(async () => changeList(await pickList(watchlist), (state, list) => setListIcon(state, { listId: list.id, icon }))),
  )

  return server
}
