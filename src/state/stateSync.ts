import type { AppState } from '../../shared/types'

export type SaveResult = { kind: 'saved'; rev: number } | { kind: 'conflict' } | { kind: 'failed' }

// The name of a save and, for one sent while another is still under way, the name of the one it goes after.
export type SaveLink = { saveId: string; follows?: string }

export type StateSync = {
  loaded: (state: AppState) => void
  changed: (state: AppState) => void
  flush: () => void
  hasUnsaved: () => boolean
  rev: () => number
  dispose: () => void
}

type SyncDeps = {
  put: (state: AppState, keepalive: boolean, saved: AppState | null, link: SaveLink) => Promise<SaveResult>
  onSaved: () => void
  onConflict: () => void
  onFailed: () => void
  setTimer: (run: () => void, ms: number) => unknown
  clearTimer: (timer: unknown) => void
  delayMs: number
  retryMs: number
}

export const createStateSync = (deps: SyncDeps): StateSync => {
  const page = Math.random().toString(36).slice(2)
  let sends = 0
  let rev = 1
  let generation = 0
  let pending: AppState | null = null
  let saved: AppState | null = null
  let inFlight: { state: AppState; id: string } | null = null
  // Saves overtaken by a follower and not answered yet.
  const unanswered = new Set<string>()
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
    const sent = pending
    const underway = inFlight
    // One save at a time, except as the page is left: the newest change then goes after the one under way.
    if (!sent || (underway && (!keepalive || sent === underway.state))) return
    // A retry waits for those answers, which give the revision to build on.
    if (!keepalive && unanswered.size > 0) {
      schedule(deps.retryMs)
      return
    }
    if (underway) unanswered.add(underway.id)
    const sentGeneration = generation
    sends += 1
    const id = `${page}-${sends}`
    inFlight = { state: sent, id }
    const link = { saveId: id, follows: underway?.id }
    deps.put({ ...sent, rev }, keepalive, underway?.state ?? saved, link).then((result) => {
      if (sentGeneration !== generation) return
      unanswered.delete(id)
      if (inFlight?.id !== id) {
        // Overtaken by a follower. What got written is still the base to try again from, should the follower not be.
        if (result.kind === 'saved' && result.rev > rev) {
          rev = result.rev
          saved = sent
        }
        return
      }
      inFlight = null
      settle(sent, result)
    })
  }

  const loaded = (state: AppState): void => {
    cancelTimer()
    generation += 1
    rev = state.rev
    saved = state
    pending = null
    inFlight = null
    unanswered.clear()
  }

  const changed = (state: AppState): void => {
    pending = state
    schedule(deps.delayMs)
  }

  const flush = (): void => {
    if (!pending) return
    cancelTimer()
    send(true)
  }

  return {
    loaded,
    changed,
    flush,
    hasUnsaved: () => pending !== null || inFlight !== null,
    rev: () => rev,
    dispose: cancelTimer,
  }
}
