import { createHash } from 'node:crypto'
import { symbolsOf } from '../shared/listItems'
import { normalizeState } from '../shared/normalizeState'
import type { AppState } from '../shared/types'
import { type AccessToken, type GoogleAuth, type GoogleErrorKind, googleError, isGoogleError } from './googleAuth'
import type { GoogleClient } from './googleClient'
import type { Drive, DriveFile } from './googleDrive'
import type { LocalStateFile, StateStore } from './stateStore'

export type SyncAction = 'none' | 'upload' | 'download' | 'choose'

type SyncSides = {
  local: { exists: boolean; hash: string; changedAt: number | null }
  remote: { hash: string; changedAt: number } | null
  // What each side held at the last sync. They differ when this computer writes Drive's copy its own way.
  synced: { remote: string; local: string } | null
}

export type GoogleSummary = { lists: number; symbols: number; drawings: number; changedAt: string | null }

export type GoogleSyncState = 'signedOut' | 'waiting' | 'idle' | 'syncing' | 'offline' | 'failed' | 'expired' | 'choose'

export type GoogleStatus = {
  configured: boolean
  email: string | null
  sync: GoogleSyncState
  signInUrl: string | null
  lastSyncAt: string | null
  choice: { local: GoogleSummary; drive: GoogleSummary } | null
  replacedRev: number | null
}

export type GoogleKeep = 'local' | 'drive'

export type GoogleAccount = {
  email: string
  refreshToken?: string
  folderId?: string
  fileId?: string
  syncedHash?: string
  localHash?: string
  lastSyncAt?: string
}

export type GoogleStore = { load: () => Promise<unknown>; save: (account: GoogleAccount) => Promise<void>; clear: () => Promise<void> }

export type GoogleSync = {
  status: () => Promise<GoogleStatus>
  signIn: () => Promise<{ url: string }>
  finishSignIn: (query: URLSearchParams) => Promise<void>
  syncNow: () => Promise<GoogleStatus>
  choose: (keep: GoogleKeep) => Promise<GoogleStatus>
  signOut: () => Promise<GoogleStatus>
  localChanged: () => void
  beforeSave: () => Promise<void>
  freshen: () => void
  start: () => Promise<void>
  stop: () => void
}

type SyncDeps = {
  client: GoogleClient | null
  auth: GoogleAuth
  makeDrive: (token: (fresh?: boolean) => Promise<string>) => Drive
  local: Pick<LocalStateFile, 'read' | 'replace' | 'changedAt' | 'keepCopy'>
  store: GoogleStore
  onReplaced: (state: AppState) => void
  now: () => number
  setTimer: (run: () => void, ms: number) => unknown
  clearTimer: (timer: unknown) => void
}

type Place = { folderId: string; file: DriveFile | null }

type Question = { hash: string; text: string; drive: AppState; choice: NonNullable<GoogleStatus['choice']> }

type Alarm = 'upload' | 'retry' | 'pull'

const UPLOAD_DELAY_MS = 3_000
const PULL_EVERY_MS = 5 * 60_000
const RETRY_MIN_MS = 30_000
const RETRY_MAX_MS = 5 * 60_000
const TOKEN_MARGIN_MS = 60_000
const FRESH_MS = 60_000
const SAVE_WAIT_MS = 5_000
const QUICK_FAIL_MS = 1_000
const SAVE_RETRY_MS = 5_000

// Secrets never live in state.json: they stay in telegram.json, backup.json and google.json, which are never uploaded.
// Any field of the state that must not leave this computer has to be added to this list.
const LOCAL_ONLY_FIELDS = ['rev', 'savedOn']

const KEPT_FIELDS = ['refreshToken', 'folderId', 'fileId', 'syncedHash', 'localHash', 'lastSyncAt'] as const

const CALLBACK_TEXTS: Partial<Record<GoogleErrorKind, string>> = {
  denied: 'Sign-in was cancelled. You can close this tab.',
  invalid_state: "This sign-in link is no longer valid. Start again from doji's Settings.",
}
const SIGNED_IN_TEXT = 'doji is now signed in to Google Drive. You can close this tab and go back to doji.'
const UNFINISHED_TEXT = "Google did not finish the sign-in. Try again from doji's Settings."

export const driveTextOf = (state: AppState): string =>
  JSON.stringify(
    Object.fromEntries(Object.entries(normalizeState(state)).filter(([field]) => !LOCAL_ONLY_FIELDS.includes(field))),
    null,
    2,
  )

export const hashOf = (text: string): string => createHash('md5').update(text).digest('hex')

export const decideSync = ({ local, remote, synced }: SyncSides): SyncAction => {
  if (!remote) return 'upload'
  if (remote.hash === local.hash) return 'none'
  if (!local.exists) return 'download'
  if (synced === null) return 'choose'
  const localSame = local.hash === synced.local || local.hash === synced.remote
  const remoteSame = remote.hash === synced.remote
  if (localSame) return remoteSame ? 'none' : 'download'
  if (remoteSame) return 'upload'
  return remote.changedAt > (local.changedAt ?? 0) ? 'download' : 'upload'
}

export const summaryOf = (state: AppState, changedAt: number | null): GoogleSummary => ({
  lists: state.watchlists.length,
  symbols: new Set(state.watchlists.flatMap((list) => symbolsOf(list.items).map((item) => item.symbol))).size,
  drawings: Object.values(state.lines).reduce((sum, drawings) => sum + drawings.length, 0),
  changedAt: changedAt === null ? null : new Date(changedAt).toISOString(),
})

export const callbackPage = (kind: GoogleErrorKind | null): string => {
  const text = kind === null ? SIGNED_IN_TEXT : (CALLBACK_TEXTS[kind] ?? UNFINISHED_TEXT)
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>doji</title>',
    '<style>body { margin: 48px auto; max-width: 420px; padding: 0 16px; font: 15px/1.5 system-ui, sans-serif; }</style></head>',
    `<body><p>${text}</p><p><a href="/">Back to doji</a></p></body>`,
    '</html>',
  ].join('\n')
}

export const trackSaves = (store: StateStore, hooks: { beforeSave: () => Promise<void>; saved: () => void }): StateStore => ({
  read: store.read,
  save: async (state, baseRev) => {
    await hooks.beforeSave()
    const outcome = await store.save(state, baseRev)
    if (outcome.ok) hooks.saved()
    return outcome
  },
})

const remoteStateFrom = (text: string): AppState | null => {
  try {
    const raw = JSON.parse(text) as { version?: unknown; watchlists?: unknown } | null
    return raw?.version === 1 && Array.isArray(raw.watchlists) ? normalizeState(raw) : null
  } catch {
    return null
  }
}

const inSync = (hash: string): Pick<GoogleAccount, 'syncedHash' | 'localHash'> => ({ syncedHash: hash, localHash: hash })

const syncedOf = ({ syncedHash, localHash }: GoogleAccount): SyncSides['synced'] =>
  syncedHash === undefined ? null : { remote: syncedHash, local: localHash ?? syncedHash }

const accountFrom = (raw: unknown): GoogleAccount | null => {
  const saved = raw as Partial<Record<keyof GoogleAccount, unknown>> | null
  if (typeof saved?.email !== 'string') return null
  const kept = KEPT_FIELDS.flatMap((field) => (typeof saved[field] === 'string' ? [[field, saved[field]]] : []))
  return { ...Object.fromEntries(kept), email: saved.email }
}

export const createGoogleSync = (deps: SyncDeps): GoogleSync => {
  // Signing in or out starts a new generation: work begun before it must not save or replace anything.
  let generation = 0
  let access: AccessToken | null = null
  let question: Question | null = null
  let answer: { keep: GoogleKeep; hash: string } | null = null
  let phase: 'idle' | 'offline' | 'failed' = 'idle'
  let replacedRev: number | null = null
  let finishing = 0
  let busy = 0
  let retryDelay = 0
  let checkedAt = 0
  let attemptedAt = 0
  let failedFast = false
  let stalledAt = 0
  let running: Promise<void> | null = null
  let queue: Promise<unknown> = Promise.resolve()
  let storeQueue: Promise<unknown> = Promise.resolve()
  let waiting: Promise<void> | null = null
  const alarms = new Map<Alarm, unknown>()

  const load = (): Promise<GoogleAccount | null> => deps.store.load().then(accountFrom, () => null)

  const inStore = (work: () => Promise<void>): Promise<void> => {
    const next = storeQueue.then(work, work)
    storeQueue = next.catch(() => undefined)
    return next
  }

  const remember = (mine: number, change: Partial<GoogleAccount>): Promise<void> =>
    inStore(async () => {
      const account = await load()
      if (mine === generation && account) await deps.store.save({ ...account, ...change })
    })

  const cancel = (alarm: Alarm): void => {
    if (alarms.has(alarm)) deps.clearTimer(alarms.get(alarm))
    alarms.delete(alarm)
  }

  const arm = (alarm: Alarm, ms: number, run: () => void): void => {
    cancel(alarm)
    alarms.set(
      alarm,
      deps.setTimer(() => {
        alarms.delete(alarm)
        run()
      }, ms),
    )
  }

  const cancelAll = (): void => [...alarms.keys()].forEach(cancel)

  const forget = (): void => {
    access = null
    question = null
    answer = null
    phase = 'idle'
    retryDelay = 0
  }

  const succeeded = (): void => {
    phase = 'idle'
    retryDelay = 0
    cancel('retry')
    answer = null
  }

  const settle = async (mine: number, change: Partial<GoogleAccount>): Promise<void> => {
    await remember(mine, { ...change, lastSyncAt: new Date(deps.now()).toISOString() })
    if (mine !== generation) return
    question = null
    succeeded()
  }

  const tokenFor =
    (mine: number) =>
    async (fresh = false): Promise<string> => {
      if (mine !== generation) throw googleError('expired')
      if (!fresh && access && deps.now() < access.expiresAt - TOKEN_MARGIN_MS) return access.accessToken
      const refreshToken = (await load())?.refreshToken
      if (!refreshToken) throw googleError('expired')
      const next = await deps.auth.refresh(refreshToken)
      if (mine === generation) access = next
      return next.accessToken
    }

  const locate = async (drive: Drive, mine: number, account: GoogleAccount): Promise<Place> => {
    const known = account.fileId ? await drive.fileInfo(account.fileId) : null
    if (known && account.folderId) return { folderId: account.folderId, file: known }
    const folderId = (await drive.findFolder()) ?? (await drive.createFolder())
    const file = await drive.findFile(folderId)
    await remember(mine, { folderId, fileId: file?.id })
    return { folderId, file }
  }

  const upload = async (drive: Drive, mine: number, { folderId, file }: Place, text: string, changedAt: number | null) => {
    if (mine !== generation) return false
    const at = changedAt ?? deps.now()
    const stored = file ? await drive.update(file.id, text, at) : await drive.create(folderId, text, at)
    // Drive's own checksum is what the next look compares with, however Drive works it out.
    await settle(mine, { fileId: stored.id, syncedHash: stored.hash, localHash: hashOf(text) })
    return true
  }

  const apply = async (mine: number, remote: AppState, hash: string, baseRev: number): Promise<boolean> => {
    if (mine !== generation) return false
    const outcome = await deps.local.replace(remote, baseRev)
    if (!outcome.ok) {
      localChanged()
      return false
    }
    replacedRev = outcome.rev
    deps.onReplaced({ ...remote, rev: outcome.rev })
    await settle(mine, { syncedHash: hash, localHash: hashOf(driveTextOf(remote)) })
    return true
  }

  // Resolves to true once this computer and Drive have been compared and the outcome dealt with.
  const reconcile = async (mine: number, account: GoogleAccount): Promise<boolean> => {
    // Settings that are gone or unreadable say nothing about the last sync. Forgetting it, even while Drive cannot
    // be reached, makes doji ask before uploading whatever is saved over them.
    const lost = (await deps.local.changedAt()) === null
    if (lost) await remember(mine, { syncedHash: undefined, localHash: undefined })
    const drive = deps.makeDrive(tokenFor(mine))
    const place = await locate(drive, mine, account)
    const changedAt = await deps.local.changedAt()
    const current = await deps.local.read()
    const text = driveTextOf(current)
    const hash = hashOf(text)
    const { file } = place
    const synced = lost ? null : syncedOf(account)
    const action = decideSync({ local: { exists: changedAt !== null, hash, changedAt }, remote: file, synced })
    if (!file || action === 'upload') return upload(drive, mine, place, text, changedAt)
    if (action === 'none') {
      await settle(mine, file.hash === hash ? inSync(hash) : {})
      return true
    }
    const answered = action === 'choose' && answer?.hash === file.hash ? answer.keep : null
    if (answered === 'local') return upload(drive, mine, place, text, changedAt)
    const theirs = question?.hash === file.hash ? question.text : await drive.download(file.id)
    const remote = remoteStateFrom(theirs)
    if (!remote) return upload(drive, mine, place, text, changedAt)
    if (action === 'download' || answered === 'drive') return apply(mine, remote, file.hash, current.rev)
    if (mine !== generation) return false
    succeeded()
    question = {
      hash: file.hash,
      text: theirs,
      drive: remote,
      choice: { local: summaryOf(current, changedAt), drive: summaryOf(remote, file.changedAt) },
    }
    return true
  }

  const failed = async (mine: number, error: unknown): Promise<void> => {
    if (mine !== generation) return
    if (isGoogleError(error) && error.kind === 'expired') {
      forget()
      cancel('retry')
      await remember(mine, { refreshToken: undefined })
      return
    }
    phase = isGoogleError(error) && error.kind === 'offline' ? 'offline' : 'failed'
    const unreached = isGoogleError(error) && (error.kind === 'offline' || error.kind === 'unavailable')
    const quick = deps.now() - attemptedAt < QUICK_FAIL_MS
    failedFast = unreached && quick
    if (unreached && !quick) stalledAt = deps.now()
    retryDelay = retryDelay ? Math.min(retryDelay * 2, RETRY_MAX_MS) : RETRY_MIN_MS
    arm('retry', retryDelay, background)
  }

  const look = async (): Promise<void> => {
    const mine = generation
    const account = await load()
    if (mine !== generation || !account?.refreshToken) return
    await reconcile(mine, account)
      .then((compared) => {
        if (!compared || mine !== generation) return
        checkedAt = deps.now()
        failedFast = false
      })
      .catch((error: unknown) => failed(mine, error))
  }

  const runCycle = (): Promise<void> => {
    attemptedAt = deps.now()
    const cycle = look().finally(() => {
      running = null
    })
    running = cycle
    return cycle
  }

  const inTurn = (work: () => Promise<void>): Promise<void> => {
    busy += 1
    const next = queue.then(work, work)
    queue = next.catch(() => undefined)
    return next.finally(() => {
      busy -= 1
    })
  }

  const requestCycle = (): Promise<void> => {
    if (!deps.client) return Promise.resolve()
    waiting ??= inTurn(() => {
      waiting = null
      return runCycle()
    })
    return waiting
  }

  const background = (): void => {
    requestCycle().catch(() => undefined)
  }

  const localChanged = (): void => {
    if (deps.client) arm('upload', UPLOAD_DELAY_MS, background)
  }

  const stale = (): boolean => deps.client !== null && question === null && deps.now() - checkedAt >= FRESH_MS

  const attemptDue = (ms = FRESH_MS): boolean => deps.now() - attemptedAt >= ms

  const endsWithin = async (ms: number, work: Promise<void>): Promise<boolean> => {
    let timer: unknown
    const limit = new Promise<boolean>((done) => {
      timer = deps.setTimer(() => done(false), ms)
    })
    const ended = await Promise.race([work.then(() => true, () => true), limit])
    deps.clearTimer(timer)
    return ended
  }

  // A change made on old settings would win over newer ones in Drive, so a save first waits for a look at Drive.
  const beforeSave = async (): Promise<void> => {
    // Once Drive has not answered in time, saves stop waiting for it for a minute.
    if (!stale() || deps.now() - stalledAt < FRESH_MS || !(await load())?.refreshToken) return
    const underway = running
    // A failure that came back at once costs a save next to nothing to try again, as when a computer has just woken.
    const cycle = underway ?? (attemptDue(failedFast ? SAVE_RETRY_MS : FRESH_MS) ? requestCycle() : null)
    // A look already under way has used up part of the wait.
    const left = underway ? SAVE_WAIT_MS - (deps.now() - attemptedAt) : SAVE_WAIT_MS
    if (cycle && left > 0 && !(await endsWithin(left, cycle))) stalledAt = deps.now()
  }

  const freshen = (): void => {
    if (stale() && !running && attemptDue()) background()
  }

  const pullLater = (): void =>
    arm('pull', PULL_EVERY_MS, () => {
      pullLater()
      background()
    })

  const status = async (): Promise<GoogleStatus> => {
    const signedOut: GoogleStatus = {
      configured: deps.client !== null,
      email: null,
      sync: 'signedOut',
      signInUrl: null,
      lastSyncAt: null,
      choice: null,
      replacedRev: null,
    }
    if (!deps.client) return signedOut
    const wasFinishing = finishing > 0
    const account = await load()
    const signInUrl = deps.auth.pendingUrl()
    const known = { ...signedOut, email: account?.email ?? null, signInUrl, lastSyncAt: account?.lastSyncAt ?? null, replacedRev }
    if (signInUrl || wasFinishing || finishing > 0) return { ...known, sync: 'waiting' }
    if (!account) return known
    if (!account.refreshToken) return { ...known, sync: 'expired' }
    if (question) return { ...known, sync: 'choose', choice: question.choice }
    return { ...known, sync: busy > 0 ? 'syncing' : phase }
  }

  const signIn = async (): Promise<{ url: string }> => {
    if (!deps.client) throw googleError('not_configured')
    return { url: deps.auth.start() }
  }

  const finishSignIn = async (query: URLSearchParams): Promise<void> => {
    const mine = generation
    finishing += 1
    try {
      const tokens = await deps.auth.finish(query)
      const email = await deps.makeDrive(async () => tokens.accessToken).email()
      if (mine !== generation) throw googleError('invalid_state')
      generation += 1
      const signedIn = generation
      forget()
      cancel('retry')
      access = tokens
      checkedAt = 0
      attemptedAt = 0
      failedFast = false
      stalledAt = 0
      await inStore(async () => {
        const before = await load()
        if (signedIn !== generation) return
        const record = before?.email === email ? before : null
        await deps.store.save({ ...record, email, refreshToken: tokens.refreshToken })
      })
      pullLater()
      background()
    } finally {
      finishing -= 1
    }
  }

  const syncNow = async (): Promise<GoogleStatus> => {
    await requestCycle()
    return status()
  }

  const choose = async (keep: GoogleKeep): Promise<GoogleStatus> => {
    await inTurn(async () => {
      const asked = question
      if (!asked) return
      const mine = generation
      // Drive's copy is about to be written over: it is kept here first, and nothing changes if that fails.
      if (keep === 'local') await deps.local.keepCopy(asked.text)
      if (mine !== generation) return
      question = null
      answer = { keep, hash: asked.hash }
      if (keep === 'local') return runCycle()
      await deps.local
        .read()
        .then((current) => apply(mine, asked.drive, asked.hash, current.rev))
        .catch((error: unknown) => failed(mine, error))
    })
    return status()
  }

  const signOut = async (): Promise<GoogleStatus> => {
    generation += 1
    cancelAll()
    forget()
    replacedRev = null
    failedFast = false
    const refreshToken = (await load())?.refreshToken
    await inStore(() => deps.store.clear())
    if (refreshToken) await deps.auth.revoke(refreshToken)
    return status()
  }

  const start = (): Promise<void> => {
    if (deps.client) pullLater()
    return requestCycle()
  }

  return { status, signIn, finishSignIn, syncNow, choose, signOut, localChanged, beforeSave, freshen, start, stop: cancelAll }
}
