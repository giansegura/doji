import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemeProvider } from 'styled-components'
import { todayIso } from '../shared/dates'
import { symbolsOf } from '../shared/listItems'
import type { AppState, Bar, Drawing, DrawingKind, IndicatorAlert, LineLook, SavedFilter, SymbolInfo } from '../shared/types'
import { ChartArea } from './components/ChartArea'
import { DrawingsList } from './components/DrawingsList'
import { EarningsCalendar } from './components/EarningsCalendar'
import { FilterBar } from './components/FilterBar'
import { IndicatorAlerts } from './components/IndicatorAlerts'
import { FilterEditor } from './components/FilterEditor'
import { LeftToolbar } from './components/LeftToolbar'
import { ListPicker } from './components/ListPicker'
import { AlertToasts } from './components/AlertToasts'
import { ListResizer } from './components/ListResizer'
import { ReplayBar } from './components/ReplayBar'
import { CompanyPanel } from './components/CompanyPanel'
import { NewsPanel } from './components/NewsPanel'
import { NotesPanel } from './components/NotesPanel'
import { PositionPanel } from './components/PositionPanel'
import { SymbolSearch } from './components/SymbolSearch'
import { TimeframePicker } from './components/TimeframePicker'
import { TopBar } from './components/TopBar'
import { Watchlist } from './components/Watchlist'
import { earningsDay } from './domain/companyProfile'
import { configFileName, serializeConfig } from './domain/configFile'
import { downloadText } from './domain/download'
import { calendarItems, earningsSoon } from './domain/earningsCalendar'
import { freshQuotes } from './domain/liveBar'
import { newId } from './domain/newId'
import { replayBars } from './domain/replay'
import { mergeShown, visibleLines } from './domain/visibleLines'
import { euroLive } from './domain/euroView'
import { convertHistory, fxPairOf } from '../shared/currency'
import { tabTitle } from './domain/tabTitle'
import { METRIC_FIELDS, allSymbols, filterItems } from './domain/filters'
import { onlyFlagged } from './domain/flags'
import { nextSort, sortItems } from './domain/watchlistSort'
import { adjustLinesForSplits } from './domain/splits'
import { askToNotify, useAlerts } from './hooks/useAlerts'
import { useCompanyProfile } from './hooks/useCompanyProfile'
import { useEarnings } from './hooks/useEarnings'
import { useFxBars } from './hooks/useFxBars'
import { useNews } from './hooks/useNews'
import { useEarningsCalendar } from './hooks/useEarningsCalendar'
import { useWatchMetrics } from './hooks/useWatchMetrics'
import { useHistory } from './hooks/useHistory'
import { useLivePrice } from './hooks/useLivePrice'
import { usePrefetchHistories } from './hooks/usePrefetchHistories'
import { useQuotes } from './hooks/useQuotes'
import { useReplay } from './hooks/useReplay'
import { useShortcuts } from './hooks/useShortcuts'
import { type Action, type Tool, activeWatchlist } from './state/appReducer'
import { useAppState } from './state/useAppState'
import * as Styles from './styles'
import { GlobalStyle } from './theme/GlobalStyle'
import { themes } from './theme/tokens'

type WorkspaceProps = { state: AppState; dispatch: (action: Action) => void; notice: string | null; replaced: number }

const NO_BARS: Bar[] = []

type SearchMode = 'chart' | 'watchlist' | null

const NO_DRAWINGS: Drawing[] = []

const NO_ALERTS: IndicatorAlert[] = []

const NO_FIELDS: never[] = []

const MAX_EXTRA_QUOTES = 120

const NEW_FILTER: Omit<SavedFilter, 'id'> = { name: '', scope: 'list', conditions: [{ field: 'rsi', op: 'below', value: 30 }] }

type FilterDraft = { filter: SavedFilter; editing: boolean }

const Workspace = ({ state, dispatch, notice, replaced }: WorkspaceProps) => {
  const [tool, setTool] = useState<Tool>('cursor')
  const [searchMode, setSearchMode] = useState<SearchMode>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [filterDraft, setFilterDraft] = useState<FilterDraft | null>(null)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [newsOpen, setNewsOpen] = useState(false)
  const screenshotRef = useRef<(() => void) | null>(null)
  const { status, history, errorCode, retry } = useHistory(state.symbol)
  const list = activeWatchlist(state)
  const listSymbols = symbolsOf(list.items).map((item) => item.symbol)
  const columns = state.watchlistColumns
  const filter = state.filters.find((saved) => saved.id === state.activeFilterId) ?? null
  const everywhere = filter?.scope === 'all'
  const fields = filter?.conditions.map((condition) => condition.field) ?? NO_FIELDS
  const everySymbol = useMemo(() => allSymbols(state.watchlists), [state.watchlists])
  const scopeItems = everywhere ? everySymbol : list.items
  const scopeSymbols = symbolsOf(scopeItems).map((item) => item.symbol)
  const metrics = useWatchMetrics(scopeSymbols, {
    enabled: columns.some((column) => column !== 'earnings') || fields.some((field) => METRIC_FIELDS.includes(field)),
    withLevel: columns.includes('level') || fields.includes('level'),
    everyList: everywhere,
  })
  usePrefetchHistories(listSymbols)
  const today = todayIso()
  const calendarSymbols = useMemo(() => calendarItems(state.watchlists).map((item) => item.symbol), [state.watchlists])
  const wantsEarnings = columns.includes('earnings') || fields.includes('earningsDays')
  const calendar = useEarningsCalendar(calendarSymbols, calendarOpen || (everywhere && wantsEarnings))
  const listEarnings = useEarningsCalendar(listSymbols, state.earningsBadge || (!everywhere && wantsEarnings))
  const viewEarnings = everywhere ? calendar.earnings : listEarnings.earnings
  const filteredItems = filter ? filterItems(scopeItems, filter, { metrics, earnings: viewEarnings, today }) : list.items
  const extraSymbols = everywhere ? symbolsOf(filteredItems).slice(0, MAX_EXTRA_QUOTES).map((item) => item.symbol) : NO_FIELDS
  const { quotes: tracked, live } = useQuotes([...new Set([...listSymbols, ...extraSymbols, state.symbol])])
  const quotes = useMemo(() => freshQuotes(tracked, history), [tracked, history])
  const livePrice = useLivePrice(history, quotes[state.symbol])
  const { fired, dismiss } = useAlerts()
  const profile = useCompanyProfile(state.symbol, companyOpen)
  const news = useNews(state.symbol, newsOpen)
  const symbolEarnings = useEarnings(state.symbol)
  const sortedItems = sortItems(filteredItems, quotes, state.watchlistSort, {
    metrics,
    earnings: viewEarnings,
    flags: state.flags,
    holdings: state.holdings,
  })
  const shownItems = state.onlyFlagged ? onlyFlagged(sortedItems, state.flags) : sortedItems
  const shownSymbols = symbolsOf(shownItems).map((item) => item.symbol)
  const soon = useMemo(() => earningsSoon(listEarnings.earnings, today), [listEarnings.earnings, today])
  const drawings = state.lines[state.symbol] ?? NO_DRAWINGS
  const symbolAlerts = state.indicatorAlerts[state.symbol] ?? NO_ALERTS
  const { changeDrawings, forgetDrawings } = useShortcuts({ symbol: state.symbol, drawings, symbols: shownSymbols, dispatch, onTool: setTool })

  useEffect(() => {
    forgetDrawings()
  }, [replaced, forgetDrawings])

  useEffect(() => {
    const bars = history?.info.symbol === state.symbol ? history.bars : []
    document.title = tabTitle(state.symbol, quotes[state.symbol] ?? null, bars)
  }, [history, quotes, state.symbol])

  useEffect(() => {
    if (!history || history.info.symbol !== state.symbol) return
    const adjusted = adjustLinesForSplits(state.lines[state.symbol] ?? [], history.splits)
    if (adjusted.changed) dispatch({ type: 'setLines', symbol: state.symbol, lines: adjusted.lines })
  }, [history, state.symbol, state.lines, dispatch])

  const fx = state.chart.currency === 'EUR' && history?.info.symbol === state.symbol ? fxPairOf(history.currency) : null
  const fxRates = useFxBars(fx?.pair ?? null)
  const fxBars = fxRates.bars
  const fxNotice = fx && fxRates.failed ? 'Could not load the euro exchange rate, so the chart shows the symbol currency' : null
  const viewed = useMemo(() => (history && fx && fxBars ? convertHistory(history, fxBars, fx.factor) : history), [history, fx?.pair, fx?.factor, fxBars])
  const inEuros = viewed !== history
  const viewCurrency = inEuros ? 'EUR' : 'original'
  const shownLines = useMemo(() => visibleLines(drawings, viewCurrency, state.drawingsHidden), [drawings, viewCurrency, state.drawingsHidden])
  const replayer = useReplay({ bars: viewed?.bars ?? NO_BARS, timeframe: state.timeframe, symbol: state.symbol })
  const { replay } = replayer
  const replayAt = replay.status === 'on' ? replay.cutoff : null
  const shownHistory = useMemo(
    () => (viewed && replayAt ? { ...viewed, bars: replayBars(viewed.bars, replayAt) } : viewed),
    [viewed, replayAt],
  )
  const shownLive = inEuros && fx && fxBars ? euroLive(livePrice, fxBars, fx.factor) : livePrice
  const chartProps = {
    symbol: state.symbol,
    status,
    history: shownHistory,
    errorCode,
    indicators: state.indicators,
    settings: state.chart,
    live: replay.status === 'off' ? shownLive : null,
    asOf: replayAt,
    onPickBar: replay.status === 'picking' ? replayer.pick : undefined,
    lines: shownLines,
    tool,
    onLinesChange: (shown: Drawing[]) => changeDrawings(mergeShown(drawings, shownLines, shown, viewCurrency)),
    looks: state.lineLooks,
    onLook: (kind: DrawingKind, look: LineLook) => dispatch({ type: 'rememberLook', kind, look }),
    onToolDone: () => setTool('cursor'),
    onRetry: retry,
    holding: inEuros ? undefined : state.holdings[state.symbol],
    currency: quotes[state.symbol]?.currency,
    inEuros,
    locked: state.drawingsLocked,
  }

  const handlePick = (info: SymbolInfo) => {
    if (searchMode === 'watchlist') {
      dispatch({ type: 'addToWatchlist', info })
      return
    }
    dispatch({ type: 'setSymbol', symbol: info.symbol })
    setSearchMode(null)
  }

  return (
    <Styles.Layout $listWidth={state.listWidth}>
      <Styles.Top>
        <TopBar
          symbol={state.symbol}
          timeframe={state.timeframe}
          theme={state.theme}
          indicators={state.indicators}
          notice={notice ?? fxNotice}
          onOpenSearch={() => setSearchMode('chart')}
          onTimeframe={(timeframe) => dispatch({ type: 'setTimeframe', timeframe })}
          onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
          onIndicators={(indicators) => dispatch({ type: 'setIndicators', indicators })}
          chart={state.chart}
          onChart={(chart) => dispatch({ type: 'setChart', chart })}
          onScreenshot={() => screenshotRef.current?.()}
          onOpenCalendar={() => setCalendarOpen(true)}
          onReplay={replay.status === 'off' ? replayer.start : replayer.exit}
          replaying={replay.status !== 'off'}
          onExportConfig={() => downloadText(serializeConfig(state), configFileName(todayIso()))}
          onImportConfig={(config) => {
            forgetDrawings()
            dispatch({ type: 'importConfig', config })
          }}
          split={state.secondChart !== null}
          onSplit={() => dispatch({ type: 'toggleSecondChart' })}
          shareHoldings={state.shareHoldings}
          onShareHoldings={(on) => dispatch({ type: 'setShareHoldings', on })}
          armedAlerts={symbolAlerts.filter((alert) => alert.armed).length}
          alerts={
            <IndicatorAlerts
              symbol={state.symbol}
              alerts={symbolAlerts}
              averages={state.indicators.sma}
              onAdd={(draft) => {
                askToNotify()
                dispatch({ type: 'addIndicatorAlert', symbol: state.symbol, alert: { ...draft, id: newId() } })
              }}
              onArm={(id, armed) => {
                if (armed) askToNotify()
                dispatch({ type: 'armIndicatorAlert', symbol: state.symbol, id, armed })
              }}
              onRemove={(id) => dispatch({ type: 'removeIndicatorAlert', symbol: state.symbol, id })}
            />
          }
        />
      </Styles.Top>
      <Styles.Tools>
        <LeftToolbar
          tool={tool}
          onTool={setTool}
          hidden={state.drawingsHidden}
          onHidden={(on) => dispatch({ type: 'setDrawingsHidden', on })}
          locked={state.drawingsLocked}
          onLocked={(on) => dispatch({ type: 'setDrawingsLocked', on })}
          drawingsList={<DrawingsList symbol={state.symbol} drawings={drawings} onChange={changeDrawings} />}
        />
      </Styles.Tools>
      <Styles.Chart>
        <Styles.Panes>
          <Styles.Pane>
            <ChartArea {...chartProps} timeframe={state.timeframe} screenshotRef={screenshotRef} />
          </Styles.Pane>
          {state.secondChart && (
            <Styles.Pane $second>
              <ChartArea {...chartProps} timeframe={state.secondChart} viewId="second" />
              <TimeframePicker
                label="Second chart timeframe"
                value={state.secondChart}
                onChange={(timeframe) => dispatch({ type: 'setSecondChart', timeframe })}
              />
            </Styles.Pane>
          )}
        </Styles.Panes>
        <AlertToasts fired={fired} onDismiss={dismiss} />
        {replay.status !== 'off' && (
          <ReplayBar
            replay={replay}
            onPickAgain={replayer.start}
            onStep={replayer.step}
            onTogglePlay={replayer.togglePlay}
            onSpeed={replayer.setSpeed}
            onExit={replayer.exit}
          />
        )}
      </Styles.Chart>
      <Styles.List>
        <ListResizer
          width={state.listWidth}
          extraColumns={columns.length}
          onResize={(width) => dispatch({ type: 'setListWidth', width })}
        />
        <Watchlist
          items={shownItems}
          sort={state.watchlistSort}
          onSort={(column) => dispatch({ type: 'setWatchlistSort', sort: nextSort(state.watchlistSort, column) })}
          header={
            <ListPicker
              lists={state.watchlists}
              activeId={list.id}
              onSelect={(id) => dispatch({ type: 'selectWatchlist', id })}
              onCreate={(name) => dispatch({ type: 'createWatchlist', id: newId(), name })}
              onRename={(id, name) => dispatch({ type: 'renameWatchlist', id, name })}
              onDelete={(id) => dispatch({ type: 'deleteWatchlist', id })}
              onDuplicate={(id) => dispatch({ type: 'duplicateWatchlist', id, newId: newId() })}
              onIcon={(id, icon) => dispatch({ type: 'setWatchlistIcon', id, icon })}
            />
          }
          quotes={quotes}
          live={live}
          activeSymbol={state.symbol}
          onSelect={(symbol) => dispatch({ type: 'setSymbol', symbol })}
          onRemove={(symbol) => dispatch({ type: 'removeFromWatchlist', symbol })}
          onMove={(from, to) => dispatch({ type: 'moveInWatchlist', from, to })}
          onAdd={() => setSearchMode('watchlist')}
          onAddSection={(title) => dispatch({ type: 'addSection', id: newId(), title })}
          onRenameSection={(id, title) => dispatch({ type: 'renameSection', id, title })}
          onRemoveSection={(id) => dispatch({ type: 'removeSection', id })}
          earningsSoon={state.earningsBadge ? soon : undefined}
          columns={columns}
          onColumns={(picked) => dispatch({ type: 'setWatchlistColumns', columns: picked })}
          metrics={metrics}
          earnings={viewEarnings}
          filtered={filter ? filter.scope : null}
          holdings={state.holdings}
          toolbar={
            <FilterBar
              filters={state.filters}
              active={filter}
              shown={symbolsOf(shownItems).length}
              total={scopeSymbols.length}
              onApply={(id) => dispatch({ type: 'applyFilter', id })}
              onNew={() => setFilterDraft({ filter: { ...NEW_FILTER, id: newId() }, editing: false })}
              onEdit={() => filter && setFilterDraft({ filter, editing: true })}
              onSaveAsList={() => {
                if (!filter) return
                dispatch({ type: 'createWatchlistWith', id: newId(), name: filter.name, items: symbolsOf(shownItems) })
                dispatch({ type: 'applyFilter', id: null })
              }}
            />
          }
          flags={state.flags}
          onFlag={(symbol, color) => dispatch({ type: 'setFlag', symbol, color })}
          onlyFlagged={state.onlyFlagged}
          onOnlyFlagged={(on) => dispatch({ type: 'setOnlyFlagged', on })}
        />
        <PositionPanel
          symbol={state.symbol}
          holding={state.holdings[state.symbol]}
          price={quotes[state.symbol]?.price ?? null}
          currency={quotes[state.symbol]?.currency}
          onChange={(holding) => dispatch({ type: 'setHolding', symbol: state.symbol, holding })}
        />
        <CompanyPanel
          symbol={state.symbol}
          open={companyOpen}
          profile={profile}
          nextEarnings={earningsDay(symbolEarnings)}
          onToggle={() => setCompanyOpen((current) => !current)}
        />
        <NewsPanel symbol={state.symbol} open={newsOpen} news={news} now={Date.now()} onToggle={() => setNewsOpen((current) => !current)} />
        <NotesPanel
          symbol={state.symbol}
          text={state.notes[state.symbol] ?? ''}
          onChange={(text) => dispatch({ type: 'setNote', symbol: state.symbol, text })}
        />
      </Styles.List>
      {searchMode && (
        <SymbolSearch onPick={handlePick} onClose={() => setSearchMode(null)} stayOpen={searchMode === 'watchlist'} />
      )}
      {filterDraft && (
        <FilterEditor
          filter={filterDraft.filter}
          editing={filterDraft.editing}
          onSave={(saved) => {
            dispatch({ type: 'saveFilter', filter: saved })
            setFilterDraft(null)
          }}
          onDelete={(id) => {
            dispatch({ type: 'deleteFilter', id })
            setFilterDraft(null)
          }}
          onClose={() => setFilterDraft(null)}
        />
      )}
      {calendarOpen && (
        <EarningsCalendar
          lists={state.watchlists}
          earnings={calendar.earnings}
          pending={calendar.pending}
          today={today}
          badge={state.earningsBadge}
          onBadge={(on) => dispatch({ type: 'setEarningsBadge', on })}
          onPick={(symbol) => dispatch({ type: 'setSymbol', symbol })}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </Styles.Layout>
  )
}

export const App = () => {
  const { state, dispatch, loadFailed, notice, retry, replaced } = useAppState()

  if (loadFailed) {
    return (
      <ThemeProvider theme={themes.doji}>
        <GlobalStyle />
        <Styles.FullScreen>
          <Styles.Message>
            Could not open doji. Is the server running?
            <Styles.ActionButton type="button" onClick={retry}>
              Retry
            </Styles.ActionButton>
          </Styles.Message>
        </Styles.FullScreen>
      </ThemeProvider>
    )
  }

  if (!state) return null

  return (
    <ThemeProvider theme={themes[state.theme]}>
      <GlobalStyle />
      <Workspace state={state} dispatch={dispatch} notice={notice} replaced={replaced} />
    </ThemeProvider>
  )
}
