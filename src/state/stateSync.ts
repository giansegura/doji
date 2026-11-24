import type { AppState } from '../../shared/types'

export type SaveResult = { kind: 'saved'; rev: number } | { kind: 'conflict' } | { kind: 'failed' }

export type StateSync = {
  loaded: (state: AppState) => void
  changed: (state: AppState) => void
  flush: () => void
  hasUnsaved: () => boolean
  rev: () => number
  dispose: () => void
}

type SyncDeps = {
  put: (state: AppState, keepalive: boolean, saved: AppState | null) => Promise<SaveResult>
  onSaved: () => void
  onConflict: () => void
  onFailed: () => void
  setTimer: (run: () => void, ms: number) => unknown
  clearTimer: (timer: unknown) => void
  delayMs: number
  retryMs: number
}

export const createStateSync = (deps: SyncDeps): StateSync => {
  let rev = 1
  let generation = 0
  let pending: AppState | null = null
  let saved: AppState | null = null
  let inFlight = false
  let timer: unknown = null

  const cancelTimer = (): void => {
    if (timer !== null) deps.clearTimer(timer)
    timer = null
  }

  const schedule = (ms: number): void => {
    cancelTimer()
    timer = deps.setTimer(() => {
      timer = null
      send(false)
    }, ms)
  }

  const settle = (sent: AppState, result: SaveResult): void => {
    if (result.kind === 'conflict') {
      pending = null
      deps.onConflict()
      return
    }
    if (result.kind === 'failed') {
      deps.onFailed()
      schedule(deps.retryMs)
      return
    }
    rev = result.rev
    saved = sent
    if (pending !== sent) {
      schedule(deps.delayMs)
      return
    }
    pending = null
    deps.onSaved()
  }

  const send = (keepalive: boolean): void => {
    if (inFlight || !pending) return
    const sent = pending
    const sentGeneration = generation
    inFlight = true
    deps.put({ ...sent, rev }, keepalive, saved).then((result) => {
      if (sentGeneration !== generation) return
      inFlight = false
      settle(sent, result)
    })
  }

  const loaded = (state: AppState): void => {
    cancelTimer()
    generation += 1
    rev = state.rev
    saved = state
    pending = null
    inFlight = false
  }

  const changed = (state: AppState): void => {
    pending = state
    schedule(deps.delayMs)
  }

  const flush = (): void => {
    if (!pending || inFlight) return
    cancelTimer()
    send(true)
  }

  return {
    loaded,
    changed,
    flush,
    hasUnsaved: () => pending !== null || inFlight,
    rev: () => rev,
    dispose: cancelTimer,
  }
}
