import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from '../../shared/types'
import { getState, putState } from '../api/client'
import { type Action, appReducer } from './appReducer'
import { type SaveResult, createStateSync } from './stateSync'

type StateApi = {
  getState: () => Promise<AppState>
  putState: (state: AppState, keepalive?: boolean, saved?: AppState | null) => Promise<SaveResult>
}

const SAVE_DELAY_MS = 300
const RETRY_DELAY_MS = 5000
const SAVE_FAILED = 'No se pudieron guardar los cambios'
const RELOADED = 'El estado cambió en otra pestaña y se ha recargado'
const DEFAULT_API: StateApi = { getState, putState }

export const useAppState = (api: StateApi = DEFAULT_API) => {
  const [state, setState] = useState<AppState | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const apiRef = useRef(api)
  const baselineRef = useRef<AppState | null>(null)

  const [tools] = useState(() => {
    const apply = (loaded: AppState, message: string | null): void => {
      baselineRef.current = loaded
      sync.loaded(loaded)
      setState(loaded)
      setNotice(message)
      setLoadFailed(false)
    }
    const reload = (message: string | null): void => {
      apiRef.current
        .getState()
        .then((loaded) => apply(loaded, message))
        .catch(() => setNotice(SAVE_FAILED))
    }
    const sync = createStateSync({
      put: (sent, keepalive, saved) => apiRef.current.putState(sent, keepalive, saved),
      onSaved: () => setNotice(null),
      onConflict: () => reload(RELOADED),
      onFailed: () => setNotice(SAVE_FAILED),
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
      delayMs: SAVE_DELAY_MS,
      retryMs: RETRY_DELAY_MS,
    })
    const load = (): void => {
      apiRef.current
        .getState()
        .then((loaded) => apply(loaded, null))
        .catch(() => setLoadFailed(true))
    }
    const refreshIfChanged = (): void => {
      if (document.visibilityState !== 'visible' || baselineRef.current === null || sync.hasUnsaved()) return
      apiRef.current
        .getState()
        .then((fresh) => {
          if (fresh.rev !== sync.rev() && !sync.hasUnsaved()) apply(fresh, null)
        })
        .catch(() => undefined)
    }
    return { sync, load, refreshIfChanged }
  })

  useEffect(() => {
    apiRef.current = api
  }, [api])

  useEffect(() => {
    tools.load()
    window.addEventListener('pagehide', tools.sync.flush)
    document.addEventListener('visibilitychange', tools.refreshIfChanged)
    return () => {
      window.removeEventListener('pagehide', tools.sync.flush)
      document.removeEventListener('visibilitychange', tools.refreshIfChanged)
      tools.sync.dispose()
    }
  }, [tools])

  useEffect(() => {
    if (state && state !== baselineRef.current) tools.sync.changed(state)
  }, [tools, state])

  const dispatch = useCallback((action: Action) => {
    setState((current) => (current ? appReducer(current, action) : current))
  }, [])

  const retry = useCallback(() => {
    setLoadFailed(false)
    tools.load()
  }, [tools])

  return { state, dispatch, loadFailed, notice, retry }
}
