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
  // The id names the copy of Drive described, so that an answer can say which one it is about.
  choice: { id: string; local: GoogleSummary; drive: GoogleSummary } | null
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
  choose: (keep: GoogleKeep, shown: string) => Promise<GoogleStatus>
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
  local: Pick<LocalStateFile, 'read' | 'replace' | 'changedAt' | 'snapshot' | 'keepCopy'>
  store: GoogleStore
  onReplaced: (state: AppState) => void
  now: () => number
  setTimer: (run: () => void, ms: number) => unknown
  clearTimer: (timer: unknown) => void
}

type Place = { folderId: string; file: DriveFile | null }

type Question = {
  hash: string
  text: string
  drive: AppState
  // How often settings had been found lost when those of this computer were read for the question.
  losses: number | null
  choice: NonNullable<GoogleStatus['choice']>
}

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
  let answer: ({ keep: GoogleKeep } & Pick<Question, 'hash' | 'losses'>) | null = null
  let phase: 'idle' | 'offline' | 'failed' = 'idle'
  let replacedRev: number | null = null
  let finishing = 0
  let busy = 0
  let retryDelay = 0
  let checkedAt = 0
  let attemptedAt = 0
  let failedFast = false
  let stalledAt = 0
  // How often settings were found lost, and how often by the time the ones being compared were read: null when
  // there were none to read, as on a new computer.
  let losses = 0
  let comparedAt: number | null = null
  // Set while the record may still describe settings lost since, as when it could not be written.
  let unforgotten = false
  // Settings being replaced with Drive's. Signing in or out lets that finish, so nothing changes once it is done.
  let applying: Promise<unknown> = Promise.resolve()
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
    // Settings lost since they were read: what is recorded here says nothing about what got saved over them.
    if (comparedAt !== null && losses !== comparedAt) unforgotten = true
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
      // Signed out, or in again, while Google answered: nothing more goes to Drive for the earlier sign-in.
      if (mine !== generation) throw googleError('expired')
      access = next
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

  const replaceLocal = async (mine: number, remote: AppState, hash: string, baseRev: number): Promise<boolean> => {
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

  const apply = (mine: number, remote: AppState, hash: string, baseRev: number): Promise<boolean> => {
    const done = replaceLocal(mine, remote, hash, baseRev)
    applying = done.catch(() => undefined)
    return done
  }

  // Settings that are gone or unreadable say nothing about the last sync. Forgetting it, even while Drive cannot be
  // reached, makes doji ask before uploading whatever is saved over them.
  const forgetIfLost = async (): Promise<boolean> => {
    if ((await deps.local.changedAt()) === null) {
      losses += 1
      unforgotten = true
    }
    if (!unforgotten) return false
    // Whichever sign-in the record belongs to by now, it says nothing about what replaces the lost settings.
    await inStore(async () => {
      const account = await load()
      if (account) await deps.store.save({ ...account, syncedHash: undefined, localHash: undefined })
    })
    unforgotten = false
    return true
  }

  // Resolves to true once this computer and Drive have been compared and the outcome dealt with.
  const reconcile = async (mine: number, account: GoogleAccount): Promise<boolean> => {
    await forgetIfLost()
    const lossesBefore = losses
    // Read after that check, not before: a save may have cleared the record since this look began.
    const record = await load()
    const drive = deps.makeDrive(tokenFor(mine))
    const place = await locate(drive, mine, account)
    const { state: current, changedAt } = await deps.local.snapshot()
    comparedAt = changedAt === null ? null : losses
    const text = driveTextOf(current)
    const hash = hashOf(text)
    const { file } = place
    // The record no longer counts if the settings were lost during this look.
    const synced = record && losses === lossesBefore ? syncedOf(record) : null
    const action = decideSync({ local: { exists: changedAt !== null, hash, changedAt }, remote: file, synced })
    if (!file || action === 'upload') return upload(drive, mine, place, text, changedAt)
    if (action === 'none') {
      await settle(mine, file.hash === hash ? inSync(hash) : {})
      return true
    }
    // An answer counts only while no settings have been lost since those it was given about were read.
    const answered = action === 'choose' && answer?.hash === file.hash && answer.losses === losses ? answer.keep : null
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
      losses: comparedAt,
      choice: { id: file.hash, local: summaryOf(current, changedAt), drive: summaryOf(remote, file.changedAt) },
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
    if (!deps.client) return
    const mine = generation
    // Settings lost since the last look are looked at again before anything is written over them, however recent it was.
    const lost = await forgetIfLost().catch(() => false)
    if (lost) checkedAt = 0
    // Once Drive has not answered in time, saves stop waiting for it for a minute.
    if (!stale() || deps.now() - stalledAt < FRESH_MS || !(await load())?.refreshToken) return
    const underway = running
    // A failure that came back at once costs a save next to nothing to try again, as when a computer has just woken.
    const spacing = lost ? 0 : failedFast ? SAVE_RETRY_MS : FRESH_MS
    const cycle = underway ?? (attemptDue(spacing) ? requestCycle() : null)
    // A look already under way has used up part of the wait.
    const left = underway ? SAVE_WAIT_MS - (deps.now() - attemptedAt) : SAVE_WAIT_MS
    // A wait begun before signing in or out says nothing about the sign-in there is now.
    if (cycle && left > 0 && !(await endsWithin(left, cycle)) && mine === generation) stalledAt = deps.now()
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
      await applying
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

  const choose = async (keep: GoogleKeep, shown: string): Promise<GoogleStatus> => {
    await inTurn(async () => {
      const asked = question
      // An answer about another copy than the one asked about now is dropped, and the person sees the new question.
      if (!asked || asked.hash !== shown) return
      const mine = generation
      // Drive's copy is about to be written over: it is kept here first, and nothing changes if that fails.
      if (keep === 'local') await deps.local.keepCopy(asked.text)
      if (mine !== generation) return
      question = null
      answer = { keep, hash: asked.hash, losses: asked.losses }
      if (keep === 'local') return runCycle()
      await deps.local
        .read()
        .then((current) => apply(mine, asked.drive, asked.hash, current.rev))
        .catch((error: unknown) => failed(mine, error))
    })
    return status()
  }

  const signOut = async (): Promise<GoogleStatus> => {
    await applying
    generation += 1
    cancelAll()
    forget()
    // A Google page still open must not sign this computer back in.
    deps.auth.cancel()
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
