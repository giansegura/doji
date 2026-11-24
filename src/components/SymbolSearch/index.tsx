import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react'
import type { SymbolInfo } from '../../../shared/types'
import { searchSymbols } from '../../api/client'
import * as Styles from './styles'

type SymbolSearchProps = {
  onPick: (info: SymbolInfo) => void
  onClose: () => void
  search?: (query: string) => Promise<SymbolInfo[]>
}

type SearchState = { status: 'idle' | 'searching' | 'done' | 'failed'; results: SymbolInfo[]; text: string }

const TYPING_PAUSE_MS = 250
const IDLE: SearchState = { status: 'idle', results: [], text: '' }

const hintFor = ({ status, results }: SearchState): string | null => {
  if (results.length > 0) return null
  if (status === 'idle') return 'Type a ticker or a company name'
  if (status === 'searching') return 'Searching…'
  if (status === 'failed') return 'Search failed'
  return 'No results'
}

export const SymbolSearch = ({ onPick, onClose, search = searchSymbols }: SymbolSearchProps) => {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>(IDLE)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef(search)
  const pickRef = useRef(onPick)
  const awaitedRef = useRef(false)
  const hint = hintFor(state)

  useEffect(() => {
    searchRef.current = search
    pickRef.current = onPick
  }, [search, onPick])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const text = query.trim()
    awaitedRef.current = false
    if (!text) {
      setState(IDLE)
      return undefined
    }
    let active = true
    setState((current) => ({ ...current, status: 'searching' }))
    const timer = setTimeout(() => {
      searchRef
        .current(text)
        .then((results) => {
          if (!active) return
          const awaited = awaitedRef.current
          awaitedRef.current = false
          setState({ status: 'done', results, text })
          setHighlight(0)
          if (awaited && results[0]) pickRef.current(results[0])
        })
        .catch(() => {
          if (!active) return
          awaitedRef.current = false
          setState({ status: 'failed', results: [], text })
        })
    }, TYPING_PAUSE_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlight((current) => Math.min(Math.max(current + step, 0), Math.max(state.results.length - 1, 0)))
    }
    if (event.key !== 'Enter') return
    if (state.status !== 'done' || state.text !== query.trim()) {
      awaitedRef.current = query.trim() !== '' && state.status !== 'failed'
      return
    }
    if (state.results[highlight]) onPick(state.results[highlight])
  }

  const handleBackdrop = (event: MouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <Styles.Backdrop data-testid="search-backdrop" onClick={handleBackdrop}>
      <Styles.Dialog role="dialog" aria-modal="true" aria-label="Symbol search" onKeyDown={handleKeyDown}>
        <Styles.Input
          ref={inputRef}
          type="text"
          placeholder="Search symbol or company"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {hint && <Styles.Hint>{hint}</Styles.Hint>}
        {state.results.length > 0 && (
          <Styles.Results role="listbox">
            {state.results.map((result, index) => (
              <Styles.Result
                key={result.symbol}
                role="option"
                aria-selected={index === highlight}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => onPick(result)}
              >
                <Styles.ResultSymbol>{result.symbol}</Styles.ResultSymbol>
                <Styles.ResultName>{result.name}</Styles.ResultName>
                <Styles.ResultExchange>{result.exchange}</Styles.ResultExchange>
              </Styles.Result>
            ))}
          </Styles.Results>
        )}
      </Styles.Dialog>
    </Styles.Backdrop>
  )
}
