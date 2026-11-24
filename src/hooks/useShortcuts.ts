import { useCallback, useEffect, useRef, useState } from 'react'
import type { Drawing } from '../../shared/types'
import { shortcutFor, stepSymbol } from '../domain/shortcuts'
import { isTyping } from '../domain/typing'
import type { Action, Tool } from '../state/appReducer'
import { createLinesHistory } from '../state/linesHistory'

type ShortcutsArgs = {
  symbol: string
  drawings: Drawing[]
  symbols: string[]
  dispatch: (action: Action) => void
  onTool: (tool: Tool) => void
}

export const useShortcuts = (args: ShortcutsArgs) => {
  const [history] = useState(() => createLinesHistory({ now: () => Date.now() }))
  const latest = useRef(args)

  useEffect(() => {
    latest.current = args
  })

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const { symbol, drawings, symbols, dispatch, onTool } = latest.current
      const shortcut = shortcutFor(event, isTyping(event.target))
      if (!shortcut) return
      event.preventDefault()
      if (shortcut.kind === 'tool') {
        onTool(shortcut.tool)
        return
      }
      if (shortcut.kind === 'step') {
        const next = stepSymbol(symbols, symbol, shortcut.by)
        if (next) dispatch({ type: 'setSymbol', symbol: next })
        return
      }
      const restored = shortcut.kind === 'undo' ? history.undo(symbol, drawings) : history.redo(symbol, drawings)
      if (restored) dispatch({ type: 'setLines', symbol, lines: restored })
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [history])

  const changeDrawings = useCallback(
    (lines: Drawing[]) => {
      const { symbol, drawings, dispatch } = latest.current
      history.record(symbol, drawings)
      dispatch({ type: 'setLines', symbol, lines })
    },
    [history],
  )

  return { changeDrawings }
}
