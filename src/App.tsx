import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemeProvider } from 'styled-components'
import { todayIso } from '../shared/dates'
import { symbolsOf } from '../shared/listItems'
import type { AppState, Drawing, DrawingKind, LineLook, SymbolInfo } from '../shared/types'
import { ChartArea } from './components/ChartArea'
import { LeftToolbar } from './components/LeftToolbar'
import { ListPicker } from './components/ListPicker'
import { AlertToasts } from './components/AlertToasts'
import { ListResizer } from './components/ListResizer'
import { NotesPanel } from './components/NotesPanel'
import { SymbolSearch } from './components/SymbolSearch'
import { TimeframePicker } from './components/TimeframePicker'
import { TopBar } from './components/TopBar'
import { Watchlist } from './components/Watchlist'
import { configFileName, serializeConfig } from './domain/configFile'
import { downloadText } from './domain/download'
import { armedSymbols } from './domain/alerts'
import { freshQuotes } from './domain/liveBar'
import { newId } from './domain/newId'
import { tabTitle } from './domain/tabTitle'
import { nextSort, sortItems } from './domain/watchlistSort'
import { adjustLinesForSplits } from './domain/splits'
import { useAlerts } from './hooks/useAlerts'
import { useHistory } from './hooks/useHistory'
import { useLivePrice } from './hooks/useLivePrice'
import { usePrefetchHistories } from './hooks/usePrefetchHistories'
import { useQuotes } from './hooks/useQuotes'
import { useShortcuts } from './hooks/useShortcuts'
import { type Action, type Tool, activeWatchlist } from './state/appReducer'
import { useAppState } from './state/useAppState'
import * as Styles from './styles'
import { GlobalStyle } from './theme/GlobalStyle'
import { themes } from './theme/tokens'

type WorkspaceProps = { state: AppState; dispatch: (action: Action) => void; notice: string | null; replaced: number }

type SearchMode = 'chart' | 'watchlist' | null

const NO_DRAWINGS: Drawing[] = []

const Workspace = ({ state, dispatch, notice, replaced }: WorkspaceProps) => {
  const [tool, setTool] = useState<Tool>('cursor')
  const [searchMode, setSearchMode] = useState<SearchMode>(null)
  const screenshotRef = useRef<(() => void) | null>(null)
  const { status, history, errorCode, retry } = useHistory(state.symbol)
  const list = activeWatchlist(state)
  const listSymbols = symbolsOf(list.items).map((item) => item.symbol)
  const alertSymbols = armedSymbols(state.lines)
  const { quotes: tracked, live } = useQuotes([...new Set([...listSymbols, ...alertSymbols, state.symbol])], undefined, alertSymbols.length > 0)
  const quotes = useMemo(() => freshQuotes(tracked, history), [tracked, history])
  const livePrice = useLivePrice(history, quotes[state.symbol])
  const { fired, dismiss } = useAlerts({ lines: state.lines, quotes, dispatch })
  const shownItems = sortItems(list.items, quotes, state.watchlistSort)
  const shownSymbols = symbolsOf(shownItems).map((item) => item.symbol)
  usePrefetchHistories(listSymbols)
  const drawings = state.lines[state.symbol] ?? NO_DRAWINGS
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

  const chartProps = {
    symbol: state.symbol,
    status,
    history,
    errorCode,
    indicators: state.indicators,
    settings: state.chart,
    live: livePrice,
    lines: drawings,
    tool,
    onLinesChange: changeDrawings,
    looks: state.lineLooks,
    onLook: (kind: DrawingKind, look: LineLook) => dispatch({ type: 'rememberLook', kind, look }),
    onToolDone: () => setTool('cursor'),
    onRetry: retry,
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
          notice={notice}
          onOpenSearch={() => setSearchMode('chart')}
          onTimeframe={(timeframe) => dispatch({ type: 'setTimeframe', timeframe })}
          onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
          onIndicators={(indicators) => dispatch({ type: 'setIndicators', indicators })}
          chart={state.chart}
          onChart={(chart) => dispatch({ type: 'setChart', chart })}
          onScreenshot={() => screenshotRef.current?.()}
          onExportConfig={() => downloadText(serializeConfig(state), configFileName(todayIso()))}
          onImportConfig={(config) => {
            forgetDrawings()
            dispatch({ type: 'importConfig', config })
          }}
          split={state.secondChart !== null}
          onSplit={() => dispatch({ type: 'toggleSecondChart' })}
        />
      </Styles.Top>
      <Styles.Tools>
        <LeftToolbar tool={tool} onTool={setTool} />
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
      </Styles.Chart>
      <Styles.List>
        <ListResizer width={state.listWidth} onResize={(width) => dispatch({ type: 'setListWidth', width })} />
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
        />
        <NotesPanel
          symbol={state.symbol}
          text={state.notes[state.symbol] ?? ''}
          onChange={(text) => dispatch({ type: 'setNote', symbol: state.symbol, text })}
        />
      </Styles.List>
      {searchMode && (
        <SymbolSearch onPick={handlePick} onClose={() => setSearchMode(null)} stayOpen={searchMode === 'watchlist'} />
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
