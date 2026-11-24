import { useEffect, useRef, useState } from 'react'
import { ThemeProvider } from 'styled-components'
import type { AppState, SymbolInfo } from '../shared/types'
import { ChartArea } from './components/ChartArea'
import { LeftToolbar } from './components/LeftToolbar'
import { ListPicker } from './components/ListPicker'
import { SymbolSearch } from './components/SymbolSearch'
import { TopBar } from './components/TopBar'
import { Watchlist } from './components/Watchlist'
import { newId } from './domain/newId'
import { adjustLinesForSplits } from './domain/splits'
import { useHistory } from './hooks/useHistory'
import { useQuotes } from './hooks/useQuotes'
import { type Action, type Tool, activeWatchlist } from './state/appReducer'
import { resolvePendingAdd } from './state/pendingAdd'
import { useAppState } from './state/useAppState'
import * as Styles from './styles'
import { GlobalStyle } from './theme/GlobalStyle'
import { themes } from './theme/tokens'

type WorkspaceProps = { state: AppState; dispatch: (action: Action) => void; notice: string | null }

type SearchMode = 'chart' | 'watchlist' | null

const Workspace = ({ state, dispatch, notice }: WorkspaceProps) => {
  const [tool, setTool] = useState<Tool>('cursor')
  const [searchMode, setSearchMode] = useState<SearchMode>(null)
  const [pendingAdd, setPendingAdd] = useState<string | null>(null)
  const screenshotRef = useRef<(() => void) | null>(null)
  const { status, history, errorCode, retry } = useHistory(state.symbol)
  const list = activeWatchlist(state)
  const quotes = useQuotes(list.items.map((item) => item.symbol))

  useEffect(() => {
    const decision = resolvePendingAdd(pendingAdd, { status, history, errorCode })
    if (decision.type === 'wait') return
    if (decision.type === 'add') dispatch({ type: 'addToWatchlist', info: decision.info })
    setPendingAdd(null)
  }, [pendingAdd, status, history, errorCode, dispatch])

  useEffect(() => {
    if (!history || history.info.symbol !== state.symbol) return
    const adjusted = adjustLinesForSplits(state.lines[state.symbol] ?? [], history.splits)
    if (adjusted.changed) dispatch({ type: 'setLines', symbol: state.symbol, lines: adjusted.lines })
  }, [history, state.symbol, state.lines, dispatch])

  const handlePick = (info: SymbolInfo) => {
    if (searchMode === 'watchlist') setPendingAdd(info.symbol)
    dispatch({ type: 'setSymbol', symbol: info.symbol })
    setSearchMode(null)
  }

  return (
    <Styles.Layout>
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
        />
      </Styles.Top>
      <Styles.Tools>
        <LeftToolbar tool={tool} onTool={setTool} />
      </Styles.Tools>
      <Styles.Chart>
        <ChartArea
          symbol={state.symbol}
          status={status}
          history={history}
          errorCode={errorCode}
          timeframe={state.timeframe}
          indicators={state.indicators}
          settings={state.chart}
          screenshotRef={screenshotRef}
          lines={state.lines[state.symbol] ?? []}
          tool={tool}
          onLinesChange={(lines) => dispatch({ type: 'setLines', symbol: state.symbol, lines })}
          onToolDone={() => setTool('cursor')}
          onRetry={retry}
        />
      </Styles.Chart>
      <Styles.List>
        <Watchlist
          items={list.items}
          header={
            <ListPicker
              lists={state.watchlists}
              activeId={list.id}
              onSelect={(id) => dispatch({ type: 'selectWatchlist', id })}
              onCreate={(name) => dispatch({ type: 'createWatchlist', id: newId(), name })}
              onRename={(id, name) => dispatch({ type: 'renameWatchlist', id, name })}
              onDelete={(id) => dispatch({ type: 'deleteWatchlist', id })}
              onDuplicate={(id) => dispatch({ type: 'duplicateWatchlist', id, newId: newId() })}
            />
          }
          quotes={quotes}
          activeSymbol={state.symbol}
          onSelect={(symbol) => dispatch({ type: 'setSymbol', symbol })}
          onRemove={(symbol) => dispatch({ type: 'removeFromWatchlist', symbol })}
          onMove={(from, to) => dispatch({ type: 'moveInWatchlist', from, to })}
          onAdd={() => setSearchMode('watchlist')}
        />
      </Styles.List>
      {searchMode && <SymbolSearch onPick={handlePick} onClose={() => setSearchMode(null)} />}
    </Styles.Layout>
  )
}

export const App = () => {
  const { state, dispatch, loadFailed, notice, retry } = useAppState()

  if (loadFailed) {
    return (
      <ThemeProvider theme={themes.dark}>
        <GlobalStyle />
        <Styles.FullScreen>
          <Styles.Message>
            No se pudo abrir doji. ¿Está el servidor en marcha?
            <Styles.ActionButton type="button" onClick={retry}>
              Reintentar
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
      <Workspace state={state} dispatch={dispatch} notice={notice} />
    </ThemeProvider>
  )
}
