import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState } from '../../shared/types'
import { getState, googleReloadNotice, putState } from '../api/client'
import { type Action, appReducer } from './appReducer'
import { type SaveLink, type SaveResult, createStateSync } from './stateSync'

type StateApi = {
  getState: () => Promise<AppState>
  putState: (state: AppState, keepalive?: boolean, saved?: AppState | null, link?: SaveLink) => Promise<SaveResult>
  whyReloaded?: (rev: number, since: number, refused: boolean) => Promise<string | null>
}

const SAVE_DELAY_MS = 300
const CHECK_MS = 5000
const RETRY_DELAY_MS = 5000
const SAVE_FAILED = 'Could not save your changes'
const RELOADED = 'The settings changed in another tab and were reloaded'
const SEEN_REV_KEY = 'doji.seenRev'
const DEFAULT_API: StateApi = { getState, putState, whyReloaded: googleReloadNotice }

// The last revision this browser showed, so that on opening it can tell what changed while it was not looking.
const lastSeenRev = (): number | null => {
  try {
    const rev = Number(localStorage.getItem(SEEN_REV_KEY))
    return Number.isInteger(rev) && rev >= 1 ? rev : null
  } catch {
    return null
  }
}

const rememberSeenRev = (rev: number): void => {
  try {
    localStorage.setItem(SEEN_REV_KEY, String(rev))
  } catch {
    return
  }
}

// With nothing seen before, or revisions that started again, only the settings on screen themselves can be news.
const unseenSince = (seen: number | null, rev: number): number => (seen !== null && seen <= rev ? seen : rev - 1)

export const useAppState = (api: StateApi = DEFAULT_API) => {
  const [state, setState] = useState<AppState | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [replaced, setReplaced] = useState(0)
  const apiRef = useRef(api)
  const baselineRef = useRef<AppState | null>(null)

  const [tools] = useState(() => {
    // Read once: a second load while the app is still opening must not count the first as already seen.
    const seenBefore = lastSeenRev()
    // Every reload and every outcome of a save puts an explanation still on its way out of date.
    let latest = 0
    const apply = (loaded: AppState, message: string | null): void => {
      baselineRef.current = loaded
      sync.loaded(loaded)
      setState(loaded)
      setNotice(message)
      setLoadFailed(false)
      setReplaced((count) => count + 1)
      rememberSeenRev(loaded.rev)
      latest += 1
    }
    const report = (message: string | null): void => {
      latest += 1
      setNotice(message)
    }
    const explain = (loaded: AppState, seen: number | null, refused: boolean): void => {
      const asked = latest
      apiRef.current
        .whyReloaded?.(loaded.rev, unseenSince(seen, loaded.rev), refused)
        .then((reason) => {
          if (reason && latest === asked) setNotice(reason)
        })
        .catch(() => undefined)
    }
    const reload = (): void => {
      apiRef.current
        .getState()
        .then((loaded) => {
          const seen = sync.rev()
          apply(loaded, RELOADED)
          explain(loaded, seen, true)
        })
        .catch(() => setNotice(SAVE_FAILED))
    }
    const sync = createStateSync({
      put: (sent, keepalive, saved, link) => apiRef.current.putState(sent, keepalive, saved, link),
      onSaved: () => report(null),
      onConflict: reload,
      onFailed: () => report(SAVE_FAILED),
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
      delayMs: SAVE_DELAY_MS,
      retryMs: RETRY_DELAY_MS,
    })
    const load = (): void => {
      apiRef.current
        .getState()
        .then((loaded) => {
          apply(loaded, null)
          explain(loaded, seenBefore, false)
        })
        .catch(() => setLoadFailed(true))
    }
    const refreshIfChanged = (): void => {
      if (document.visibilityState !== 'visible' || baselineRef.current === null || sync.hasUnsaved()) return
      apiRef.current
        .getState()
        .then((fresh) => {
          const seen = sync.rev()
          if (fresh.rev <= seen || sync.hasUnsaved()) return
          apply(fresh, null)
          explain(fresh, seen, false)
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
    const check = setInterval(tools.refreshIfChanged, CHECK_MS)
    return () => {
      clearInterval(check)
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

  return { state, dispatch, loadFailed, notice, retry, replaced, refresh: tools.refreshIfChanged }
}
