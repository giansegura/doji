import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { normalizeState } from '../shared/normalizeState'
import { type AppState, DEFAULT_STATE, type HorizontalLine } from '../shared/types'
import { createAlertMonitor } from './alertMonitor'
import { type GoogleAuth, type GoogleErrorKind, googleError, isGoogleError } from './googleAuth'
import type { Drive, DriveFile } from './googleDrive'
import { type SaveOutcome, createStateStore } from './stateStore'
import { callbackPage, createGoogleSync, decideSync, driveTextOf, hashOf, summaryOf, trackSaves } from './googleSync'

const NOW = Date.parse('2026-11-27T12:00:00.000Z')
const MINUTE = 60_000
const CLIENT = { id: 'client-id', secret: 'client-secret' }

const stateWith = (symbol: string, over: Partial<AppState> = {}): AppState => ({ ...DEFAULT_STATE, symbol, ...over })

const idle = () => new Promise<void>((done) => setTimeout(done, 0))

type StoredFile = { id: string; folderId: string; text: string; changedAt: number; trashed: boolean }

const fakeGoogle = () => {
  const box = { down: null as GoogleErrorKind | null, expired: false, email: 'ana@example.com', checksum: '' }
  const folders: string[] = []
  const files: StoredFile[] = []
  const uploads: string[] = []
  const revoked: string[] = []
  const refreshes: string[] = []
  const infoOf = (file: StoredFile): DriveFile => ({
    id: file.id,
    hash: createHash('md5').update(box.checksum + file.text).digest('hex'),
    changedAt: file.changedAt,
  })
  const found = (id: string) => files.find((file) => file.id === id && !file.trashed)
  const put = (text: string, changedAt: number): void => {
    if (folders.length === 0) folders.push('folder-1')
    const file = files.find((candidate) => !candidate.trashed)
    if (file) Object.assign(file, { text, changedAt })
    else files.push({ id: `file-${files.length + 1}`, folderId: folders[0], text, changedAt, trashed: false })
  }
  const stored = (): string | undefined => files.find((file) => !file.trashed)?.text
  const drive = (token: (fresh?: boolean) => Promise<string>, gate: () => Promise<void>): Drive => {
    const reach = async (): Promise<void> => {
      await token()
      await gate()
      if (box.down) throw googleError(box.down)
    }
    const write = async (file: StoredFile, text: string, changedAt: number): Promise<DriveFile> => {
      Object.assign(file, { text, changedAt })
      uploads.push(text)
      return infoOf(file)
    }
    return {
      email: async () => {
        await reach()
        return box.email
      },
      findFolder: async () => {
        await reach()
        return folders[0] ?? null
      },
      createFolder: async () => {
        await reach()
        folders.push(`folder-${folders.length + 1}`)
        return folders.at(-1) as string
      },
      findFile: async (folderId) => {
        await reach()
        const file = files.find((candidate) => candidate.folderId === folderId && !candidate.trashed)
        return file ? infoOf(file) : null
      },
      fileInfo: async (id) => {
        await reach()
        const file = found(id)
        return file ? infoOf(file) : null
      },
      download: async (id) => {
        await reach()
        return found(id)?.text ?? ''
      },
      create: async (folderId, text, changedAt) => {
        await reach()
        const file = { id: `file-${files.length + 1}`, folderId, text: '', changedAt, trashed: false }
        files.push(file)
        return write(file, text, changedAt)
      },
      update: async (id, text, changedAt) => {
        await reach()
        return write(found(id) as StoredFile, text, changedAt)
      },
    }
  }
  return { box, folders, files, uploads, revoked, refreshes, drive, put, stored }
}

type Google = ReturnType<typeof fakeGoogle>

const fakeAuth = (google: Google, clock: { at: number }) => {
  let pending: string | null = null
  let exchange: () => Promise<void> = async () => undefined
  let refreshing: () => Promise<void> = async () => undefined
  const auth: GoogleAuth = {
    start: () => (pending = 'https://accounts.example/sign-in?state=s1'),
    pendingUrl: () => pending,
    cancel: () => {
      pending = null
    },
    finish: async (query) => {
      if (!pending) throw googleError('invalid_state')
      pending = null
      await exchange()
      if (query.get('error')) throw googleError('denied')
      return { accessToken: 'access-secret', expiresAt: clock.at + 60 * MINUTE, refreshToken: 'refresh-secret' }
    },
    refresh: async (token) => {
      google.refreshes.push(token)
      await refreshing()
      if (google.box.expired) throw googleError('expired')
      return { accessToken: 'access-secret-2', expiresAt: clock.at + 60 * MINUTE }
    },
    revoke: async (token) => {
      google.revoked.push(token)
    },
  }
  return {
    auth,
    holdExchange: (wait: () => Promise<void>) => {
      exchange = wait
    },
    holdRefresh: (wait: () => Promise<void>) => {
      refreshing = wait
    },
  }
}

const computer = (google: Google, initial: AppState | null = null, saved: unknown = null) => {
  const clock = { at: NOW }
  const local = { state: initial, changedAt: initial ? NOW - MINUTE : (null as number | null), refusals: 0, keepFails: false, keeping: undefined as Promise<void> | undefined, reportedTime: undefined as number | undefined, timing: undefined as Promise<void> | undefined, replacing: undefined as Promise<void> | undefined }
  const kept: string[] = []
  const copies: AppState[] = []
  const replaced: AppState[] = []
  const account = { saved, refuses: false, failReads: 0, beforeToken: () => undefined as void }
  const timers: { run: () => void; ms: number }[] = []
  const gate = { wait: async () => undefined as void }
  const tokens: string[] = []
  const { auth, holdExchange, holdRefresh } = fakeAuth(google, clock)
  const read = async () => local.state ?? normalizeState(null)
  const sync = createGoogleSync({
    client: CLIENT,
    auth,
    makeDrive: (token) =>
      google.drive(
        async (fresh) => {
          account.beforeToken()
          const value = await token(fresh)
          tokens.push(value)
          return value
        },
        () => gate.wait(),
      ),
    local: {
      read,
      changedAt: async () => {
        const wait = local.timing
        local.timing = undefined
        await wait
        return local.reportedTime ?? local.changedAt
      },
      snapshot: async () => ({ state: await read(), changedAt: local.changedAt }),
      keepCopy: async (text) => {
        if (local.keepFails) throw new Error('disk full')
        await local.keeping
        kept.push(text)
      },
      replace: async (state, baseRev) => {
        await local.replacing
        const current = await read()
        if (local.refusals > 0 || baseRev !== current.rev) {
          local.refusals -= 1
          return { ok: false, reason: 'conflict' }
        }
        if (local.state) copies.push(local.state)
        local.state = { ...normalizeState(state), rev: current.rev + 1 }
        local.changedAt = clock.at
        return { ok: true, rev: local.state.rev }
      },
    },
    store: {
      load: async () => {
        if (account.failReads > 0) {
          account.failReads -= 1
          throw new Error('cannot read')
        }
        if (account.saved === null) throw new Error('no file')
        return account.saved
      },
      save: async (data) => {
        if (account.refuses) throw new Error('disk full')
        account.saved = JSON.parse(JSON.stringify(data))
      },
      clear: async () => {
        account.saved = null
      },
    },
    onReplaced: (state) => replaced.push(state),
    now: () => clock.at,
    setTimer: (run, ms) => {
      const timer = { run, ms }
      timers.push(timer)
      return timer
    },
    clearTimer: (timer) => {
      const index = timers.indexOf(timer as (typeof timers)[number])
      if (index >= 0) timers.splice(index, 1)
    },
  })
  const save = async (state: AppState, baseRev: number): Promise<SaveOutcome> => {
    const current = await read()
    if (baseRev !== current.rev) return { ok: false, reason: 'conflict' }
    local.state = { ...normalizeState(state), rev: current.rev + 1 }
    local.changedAt = clock.at
    return { ok: true, rev: local.state.rev }
  }
  // The saves of the app, the program for AI apps and the alert monitor, as the server wires them.
  const saves = trackSaves({ read, save }, { beforeSave: () => sync.beforeSave(), saved: () => sync.localChanged() })
  const change = async (over: Partial<AppState>) => {
    const current = await saves.read()
    return saves.save({ ...current, ...over }, current.rev)
  }
  const delays = () => timers.map((timer) => timer.ms).sort((a, b) => a - b)
  const fire = async (ms: number) => {
    const index = timers.findIndex((timer) => timer.ms === ms)
    expect(index, `a timer of ${ms} ms among ${delays().join(', ')}`).toBeGreaterThanOrEqual(0)
    timers.splice(index, 1)[0].run()
    await idle()
  }
  const signIn = async () => {
    await sync.signIn()
    await sync.finishSignIn(new URLSearchParams({ code: 'c1', state: 's1' }))
    await idle()
  }
  const edit = (symbol: string, at = clock.at) => {
    const current = local.state ?? normalizeState(null)
    local.state = { ...current, symbol, rev: current.rev + 1 }
    local.changedAt = at
    sync.localChanged()
  }
  return { sync, clock, local, copies, kept, replaced, account, gate, tokens, saves, change, delays, fire, signIn, edit, holdExchange, holdRefresh }
}

const SECRETS = /refresh-secret|access-secret/

const file = (symbol: string, changedAt: number) => ({ hash: symbol, changedAt })

const known = (remote: string, local = remote) => ({ remote, local })

const here = (hash: string, changedAt = 1) => ({ exists: true, hash, changedAt })

const GONE = { exists: false, hash: 'a', changedAt: null }

// Answers the question as the person does who has just seen it.
const choose = async (pc: ReturnType<typeof computer>, keep: 'local' | 'drive') =>
  pc.sync.choose(keep, (await pc.sync.status()).choice?.id ?? '')

test('Should upload when Drive has no file', () => {
  expect(decideSync({ local: here('a'), remote: null, synced: known('a') })).toBe('upload')
  expect(decideSync({ local: GONE, remote: null, synced: null })).toBe('upload')
})

test('Should do nothing when both sides have the same content', () => {
  expect(decideSync({ local: here('a'), remote: file('a', 2), synced: null })).toBe('none')
  expect(decideSync({ local: here('a'), remote: file('a', 2), synced: known('b') })).toBe('none')
})

test('Should ask the first time when this computer and Drive differ', () => {
  expect(decideSync({ local: here('a'), remote: file('b', 2), synced: null })).toBe('choose')
})

test('Should take the copy of Drive on a computer without settings', () => {
  expect(decideSync({ local: GONE, remote: file('b', 2), synced: null })).toBe('download')
})

test('Should take the copy of Drive rather than upload defaults when the settings file went missing', () => {
  expect(decideSync({ local: GONE, remote: file('b', 2), synced: known('b') })).toBe('download')
})

test('Should download when only Drive changed', () => {
  expect(decideSync({ local: here('a', 9), remote: file('b', 2), synced: known('a') })).toBe('download')
})

test('Should upload when only this computer changed', () => {
  expect(decideSync({ local: here('b'), remote: file('a', 9), synced: known('a') })).toBe('upload')
})

test('Should let the last change win when both sides changed', () => {
  const both = (localAt: number, driveAt: number) =>
    decideSync({ local: here('b', localAt), remote: file('c', driveAt), synced: known('a') })
  expect(both(1, 2)).toBe('download')
  expect(both(2, 1)).toBe('upload')
  expect(both(2, 2)).toBe('upload')
})

test('Should leave alone a computer that keeps the copy of Drive written its own way', () => {
  expect(decideSync({ local: here('mine', 9), remote: file('theirs', 2), synced: known('theirs', 'mine') })).toBe('none')
})

test('Should download over a computer that did not change what it wrote, however it wrote it', () => {
  expect(decideSync({ local: here('mine', 9), remote: file('newer', 2), synced: known('theirs', 'mine') })).toBe('download')
  expect(decideSync({ local: here('theirs', 9), remote: file('newer', 2), synced: known('theirs', 'mine') })).toBe('download')
})

test('Should upload a change made over a copy of Drive written its own way', () => {
  expect(decideSync({ local: here('changed'), remote: file('theirs', 9), synced: known('theirs', 'mine') })).toBe('upload')
})

test('Should leave out of Drive what only matters on this computer', () => {
  const onDisk = { ...stateWith('KO'), rev: 12, savedOn: '2026-11-27', token: 'secret' } as unknown as AppState
  const sent = JSON.parse(driveTextOf(onDisk)) as Record<string, unknown>
  expect(sent).not.toHaveProperty('rev')
  expect(sent).not.toHaveProperty('savedOn')
  expect(sent).not.toHaveProperty('token')
  expect(sent).toMatchObject({ version: 1, symbol: 'KO', watchlists: DEFAULT_STATE.watchlists })
  expect(driveTextOf(stateWith('KO', { rev: 3 }))).toBe(driveTextOf(stateWith('KO', { rev: 90 })))
})

test('Should write the same text again after a round trip through Drive', () => {
  const rich = normalizeState({
    watchlists: [{ id: 'a', name: 'Banks', icon: '🏦', items: [{ symbol: 'SAN.MC', name: 'Santander', exchange: 'MCE' }, { kind: 'section', id: 's', title: 'US' }] }],
    lines: { KO: [{ kind: 'hline', id: 'h', pane: 'price', value: 60, alert: true, text: 'R1' }, { id: 't', pane: 'price', p1: { date: '2026-11-02', value: 1 }, p2: { date: '2026-11-20', value: 2 } }] },
    notes: { KO: 'tesis' },
    holdings: { KO: { quantity: 2, price: 50 } },
    flags: { KO: 'red' },
    filters: [{ id: 'f', name: 'Cheap', scope: 'all', conditions: [{ field: 'rsi', op: 'below', value: 30 }] }],
    indicatorAlerts: { KO: [{ id: 'i', kind: 'rsi', value: 30, armed: true }] },
    lineLooks: { hline: { color: '#FFFFFF', width: 2, lineStyle: 'dashed' } },
    alertHistory: [{ id: 'e', symbol: 'KO', level: 60, price: 61, direction: 'up', at: '2026-11-27T10:00:00.000Z', text: null }],
  })
  const sent = driveTextOf(rich)
  expect(driveTextOf(normalizeState(JSON.parse(sent)))).toBe(sent)
})

test('Should hash a text the way Drive does', () => {
  expect(hashOf('doji')).toBe(createHash('md5').update('doji').digest('hex'))
  expect(hashOf('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
})

test('Should sum up what a copy holds', () => {
  const state = stateWith('KO', {
    watchlists: [
      { id: 'a', name: 'A', items: [{ symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }, { kind: 'section', id: 's', title: 'Tech' }] },
      { id: 'b', name: 'B', items: [{ symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }, { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ' }] },
    ],
    lines: normalizeState({ lines: { KO: [{ kind: 'hline', id: '1', pane: 'price', value: 1 }, { kind: 'hline', id: '2', pane: 'price', value: 2 }], MSFT: [{ kind: 'hline', id: '3', pane: 'price', value: 3 }] } }).lines,
  })
  expect(summaryOf(state, NOW)).toEqual({ lists: 2, symbols: 2, drawings: 3, changedAt: '2026-11-27T12:00:00.000Z' })
  expect(summaryOf(state, null).changedAt).toBeNull()
})

test('Should answer the return from Google with a fixed page', () => {
  expect(callbackPage(null)).toContain('doji is now signed in to Google Drive. You can close this tab and go back to doji.')
  expect(callbackPage('denied')).toContain('Sign-in was cancelled. You can close this tab.')
  expect(callbackPage('invalid_state')).toContain("This sign-in link is no longer valid. Start again from doji's Settings.")
  const other = "Google did not finish the sign-in. Try again from doji's Settings."
  expect([callbackPage('offline'), callbackPage('unavailable'), callbackPage('not_configured')].every((page) => page.includes(other))).toBe(true)
  expect(callbackPage('denied')).toContain('<a href="/">Back to doji</a>')
})

test('Should look before each save and tell about the ones that were accepted', async () => {
  const steps: string[] = []
  const store = trackSaves(
    {
      read: async () => stateWith('KO'),
      save: async (_state, baseRev) => {
        steps.push('save')
        return baseRev === 1 ? { ok: true, rev: 2 } : { ok: false, reason: 'conflict' }
      },
    },
    {
      beforeSave: async () => {
        await idle()
        steps.push('look')
      },
      saved: () => steps.push('saved'),
    },
  )
  expect(await store.save(DEFAULT_STATE, 5)).toEqual({ ok: false, reason: 'conflict' })
  expect(steps.splice(0)).toEqual(['look', 'save'])
  expect(await store.save(DEFAULT_STATE, 1)).toEqual({ ok: true, rev: 2 })
  expect(steps.splice(0)).toEqual(['look', 'save', 'saved'])
  expect((await store.read()).symbol).toBe('KO')
  expect(steps).toEqual([])
})

test('Should do nothing without a Google client', async () => {
  const google = fakeGoogle()
  const timers: unknown[] = []
  const sync = createGoogleSync({
    client: null,
    auth: fakeAuth(google, { at: NOW }).auth,
    makeDrive: (token) => google.drive(token, async () => undefined),
    local: {
      read: async () => DEFAULT_STATE,
      replace: async () => ({ ok: true, rev: 2 }),
      keepCopy: async () => undefined,
      changedAt: async () => NOW,
      snapshot: async () => ({ state: DEFAULT_STATE, changedAt: NOW }),
    },
    store: { load: async () => ({ email: 'ana@example.com', refreshToken: 'r' }), save: async () => undefined, clear: async () => undefined },
    onReplaced: () => undefined,
    now: () => NOW,
    setTimer: (run) => timers.push(run),
    clearTimer: () => undefined,
  })
  await sync.start()
  sync.localChanged()
  sync.freshen()
  await sync.beforeSave()
  expect(await sync.status()).toEqual({
    configured: false,
    email: null,
    sync: 'signedOut',
    signInUrl: null,
    lastSyncAt: null,
    choice: null,
    replacedRev: null,
  })
  await expect(sync.signIn()).rejects.toSatisfy((error: unknown) => isGoogleError(error) && error.kind === 'not_configured')
  expect(timers).toEqual([])
  expect(google.folders).toEqual([])
})

test('Should wait for the person while they sign in on the Google page', async () => {
  const pc = computer(fakeGoogle())
  expect(await pc.sync.status()).toMatchObject({ configured: true, sync: 'signedOut', email: null, signInUrl: null })
  expect(await pc.sync.signIn()).toEqual({ url: 'https://accounts.example/sign-in?state=s1' })
  expect(await pc.sync.status()).toMatchObject({ sync: 'waiting', signInUrl: 'https://accounts.example/sign-in?state=s1' })
})

test('Should keep saying it is waiting, then syncing, until the sign-in is over', async () => {
  const pc = computer(fakeGoogle())
  let release: () => void = () => undefined
  pc.holdExchange(() => new Promise<void>((done) => (release = done)))
  await pc.sync.signIn()
  const finishing = pc.sync.finishSignIn(new URLSearchParams({ code: 'c1', state: 's1' }))
  await idle()
  expect(await pc.sync.status()).toMatchObject({ sync: 'waiting', signInUrl: null })
  let open: () => void = () => undefined
  const shut = new Promise<void>((done) => (open = done))
  let calls = 0
  pc.gate.wait = () => ((calls += 1) > 1 ? shut : Promise.resolve())
  release()
  await finishing
  expect(await pc.sync.status()).toMatchObject({ sync: 'syncing', email: 'ana@example.com' })
  open()
  await idle()
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle' })
})

test('Should create doji/state.json from this computer the first time, with no secrets in it', async () => {
  const google = fakeGoogle()
  const pc = computer(google, stateWith('KO', { rev: 7 }))
  await pc.signIn()
  expect(google.folders).toEqual(['folder-1'])
  expect(google.uploads).toEqual([driveTextOf(stateWith('KO'))])
  expect(google.files[0]).toMatchObject({ folderId: 'folder-1', changedAt: NOW - MINUTE })
  expect(pc.account.saved).toEqual({
    email: 'ana@example.com',
    refreshToken: 'refresh-secret',
    folderId: 'folder-1',
    fileId: 'file-1',
    syncedHash: hashOf(driveTextOf(stateWith('KO'))),
    localHash: hashOf(driveTextOf(stateWith('KO'))),
    lastSyncAt: '2026-11-27T12:00:00.000Z',
  })
  const status = await pc.sync.status()
  expect(status).toEqual({
    configured: true,
    email: 'ana@example.com',
    sync: 'idle',
    signInUrl: null,
    lastSyncAt: '2026-11-27T12:00:00.000Z',
    choice: null,
    replacedRev: null,
  })
  expect(JSON.stringify(status)).not.toMatch(SECRETS)
  expect(google.uploads.join()).not.toMatch(SECRETS)
})

test('Should bring the settings of Drive to a computer that has none, without asking', async () => {
  const google = fakeGoogle()
  google.put(driveTextOf(stateWith('NVDA')), NOW - MINUTE)
  const pc = computer(google)
  await pc.signIn()
  expect(pc.local.state).toMatchObject({ symbol: 'NVDA', rev: 2 })
  expect(pc.replaced).toEqual([pc.local.state])
  expect(google.uploads).toEqual([])
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle', replacedRev: 2, choice: null })
})

const differing = async () => {
  const google = fakeGoogle()
  google.put(driveTextOf(stateWith('NVDA')), NOW - 2 * MINUTE)
  const pc = computer(google, stateWith('KO', { rev: 4 }))
  await pc.signIn()
  return { google, pc }
}

test('Should ask which copy to keep when this computer and Drive differ', async () => {
  const { google, pc } = await differing()
  expect(await pc.sync.status()).toMatchObject({
    sync: 'choose',
    lastSyncAt: null,
    choice: {
      local: { lists: 1, symbols: 8, drawings: 0, changedAt: '2026-11-27T11:59:00.000Z' },
      drive: { lists: 1, symbols: 8, drawings: 0, changedAt: '2026-11-27T11:58:00.000Z' },
    },
  })
  pc.edit('MSFT')
  await pc.fire(3_000)
  await pc.fire(5 * MINUTE)
  expect(google.uploads).toEqual([])
  expect(pc.local.state?.symbol).toBe('MSFT')
  expect(pc.replaced).toEqual([])
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose', choice: { local: { changedAt: '2026-11-27T12:00:00.000Z' } } })
})

test('Should use the copy of Drive when chosen, keeping the one of this computer', async () => {
  const { google, pc } = await differing()
  const status = await choose(pc, 'drive')
  expect(status).toMatchObject({ sync: 'idle', replacedRev: 5, choice: null, lastSyncAt: '2026-11-27T12:00:00.000Z' })
  expect(pc.local.state).toMatchObject({ symbol: 'NVDA', rev: 5 })
  expect(pc.copies.map((state) => state.symbol)).toEqual(['KO'])
  expect(pc.replaced).toEqual([pc.local.state])
  expect(google.uploads).toEqual([])
  const taken = hashOf(driveTextOf(stateWith('NVDA')))
  expect(pc.account.saved).toMatchObject({ syncedHash: taken, localHash: taken })
})

test('Should upload the copy of this computer when chosen', async () => {
  const { google, pc } = await differing()
  const status = await choose(pc, 'local')
  expect(status).toMatchObject({ sync: 'idle', replacedRev: null, choice: null })
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
  expect(pc.local.state?.symbol).toBe('KO')
  expect(pc.copies).toEqual([])
})

test('Should ask again when Drive changed after the question was asked', async () => {
  const { google, pc } = await differing()
  google.put(driveTextOf(stateWith('TSLA')), NOW)
  const status = await choose(pc, 'local')
  expect(status.sync).toBe('choose')
  expect(google.stored()).toBe(driveTextOf(stateWith('TSLA')))
  expect(await choose(pc, 'drive')).toMatchObject({ sync: 'idle' })
  expect(pc.local.state?.symbol).toBe('TSLA')
})

test('Should remember the choice of this computer while offline and upload it later', async () => {
  const { google, pc } = await differing()
  google.box.down = 'offline'
  expect(await choose(pc, 'local')).toMatchObject({ sync: 'offline', choice: null })
  google.box.down = null
  await pc.fire(30_000)
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle' })
})

test('Should use the copy of Drive it already has even while offline', async () => {
  const { google, pc } = await differing()
  google.box.down = 'offline'
  await pc.fire(5 * MINUTE)
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  await choose(pc, 'drive')
  expect(pc.local.state?.symbol).toBe('NVDA')
})

test('Should ignore an answer when there is no question', async () => {
  const google = fakeGoogle()
  const pc = computer(google, stateWith('KO'))
  await pc.signIn()
  expect(await choose(pc, 'drive')).toMatchObject({ sync: 'idle' })
  expect(pc.copies).toEqual([])
  expect(google.uploads).toHaveLength(1)
})

test('Should not ask anything when both copies are already the same', async () => {
  const google = fakeGoogle()
  google.put(driveTextOf(stateWith('KO')), NOW - MINUTE)
  const pc = computer(google, stateWith('KO', { rev: 9 }))
  await pc.signIn()
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle', choice: null, lastSyncAt: '2026-11-27T12:00:00.000Z' })
  expect(google.uploads).toEqual([])
  expect(pc.copies).toEqual([])
})

const synced = async (google = fakeGoogle()) => {
  const pc = computer(google, stateWith('KO'))
  await pc.signIn()
  google.uploads.splice(0)
  return { google, pc }
}

test('Should upload once, three seconds after the last of several changes', async () => {
  const { google, pc } = await synced()
  pc.edit('MSFT')
  pc.edit('NVDA')
  pc.edit('TSLA')
  await idle()
  expect(google.uploads).toEqual([])
  expect(pc.delays()).toEqual([3_000, 5 * MINUTE])
  await pc.fire(3_000)
  expect(google.uploads).toEqual([driveTextOf(stateWith('TSLA'))])
  expect(pc.delays()).toEqual([5 * MINUTE])
  expect(google.folders).toHaveLength(1)
  expect(google.files).toHaveLength(1)
})

test('Should upload a change made while an upload was under way', async () => {
  const { google, pc } = await synced()
  let open: () => void = () => undefined
  const shut = new Promise<void>((done) => (open = done))
  let calls = 0
  pc.gate.wait = () => ((calls += 1) === 2 ? shut : Promise.resolve())
  pc.edit('MSFT')
  await pc.fire(3_000)
  pc.edit('NVDA')
  await pc.fire(3_000)
  open()
  await idle()
  expect(google.stored()).toBe(driveTextOf(stateWith('NVDA')))
  expect(google.uploads.at(-1)).toBe(driveTextOf(stateWith('NVDA')))
})

test('Should download what another computer uploaded and say the settings were replaced', async () => {
  const { google, pc } = await synced()
  const other = computer(google)
  await other.signIn()
  other.clock.at = NOW + MINUTE
  other.edit('NVDA')
  await other.fire(3_000)
  pc.clock.at = NOW + 2 * MINUTE
  const status = await pc.sync.syncNow()
  expect(pc.local.state).toMatchObject({ symbol: 'NVDA' })
  expect(pc.copies.map((state) => state.symbol)).toEqual(['KO'])
  expect(pc.replaced).toEqual([pc.local.state])
  expect(status).toMatchObject({ sync: 'idle', replacedRev: pc.local.state?.rev, lastSyncAt: '2026-11-27T12:02:00.000Z' })
})

test('Should look at Drive every five minutes', async () => {
  const { google, pc } = await synced()
  await pc.sync.start()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  await pc.fire(5 * MINUTE)
  expect(pc.local.state?.symbol).toBe('NVDA')
  expect(pc.delays()).toEqual([5 * MINUTE])
  google.put(driveTextOf(stateWith('TSLA')), NOW + 6 * MINUTE)
  await pc.fire(5 * MINUTE)
  expect(pc.local.state?.symbol).toBe('TSLA')
})

test('Should read Drive again before uploading, so a newer change of another computer wins', async () => {
  const { google, pc } = await synced()
  pc.edit('MSFT', NOW + MINUTE)
  google.put(driveTextOf(stateWith('NVDA')), NOW + 2 * MINUTE)
  await pc.fire(3_000)
  expect(google.uploads).toEqual([])
  expect(pc.local.state?.symbol).toBe('NVDA')
  expect(pc.copies.map((state) => state.symbol)).toEqual(['MSFT'])
})

test('Should upload over an older change of another computer', async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  pc.edit('MSFT', NOW + 2 * MINUTE)
  await pc.fire(3_000)
  expect(google.stored()).toBe(driveTextOf(stateWith('MSFT')))
  expect(pc.replaced).toEqual([])
  expect(google.files[0].changedAt).toBe(NOW + 2 * MINUTE)
})

test.each([
  ['text that is not JSON', 'not json'],
  ['no version', JSON.stringify({ watchlists: [] })],
  ['another version', JSON.stringify({ version: 2, watchlists: [] })],
  ['no watchlists', JSON.stringify({ version: 1 })],
  ['an empty file', ''],
])('Should never replace the settings with a Drive file holding %s', async (_name, text) => {
  const { google, pc } = await synced()
  google.put(text, NOW + MINUTE)
  await pc.sync.syncNow()
  expect(pc.local.state?.symbol).toBe('KO')
  expect(pc.replaced).toEqual([])
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should not offer a broken Drive file the first time', async () => {
  const google = fakeGoogle()
  google.put('not json', NOW)
  const pc = computer(google, stateWith('KO'))
  await pc.signIn()
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle', choice: null })
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should create the file again when it was put in the bin', async () => {
  const { google, pc } = await synced()
  google.files[0].trashed = true
  await pc.sync.syncNow()
  expect(google.files).toHaveLength(2)
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
  expect(pc.account.saved).toMatchObject({ fileId: 'file-2' })
})

test('Should try again shortly when a save lands while the copy of Drive is being applied', async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  pc.local.refusals = 1
  await pc.sync.syncNow()
  expect(pc.local.state?.symbol).toBe('KO')
  expect(pc.replaced).toEqual([])
  await pc.fire(3_000)
  expect(pc.local.state?.symbol).toBe('NVDA')
})

test('Should keep working offline and try again with longer waits until it gets through', async () => {
  const { google, pc } = await synced()
  await pc.sync.start()
  google.box.down = 'offline'
  pc.edit('MSFT')
  await pc.fire(3_000)
  expect(await pc.sync.status()).toMatchObject({ sync: 'offline', lastSyncAt: '2026-11-27T12:00:00.000Z' })
  for (const wait of [30_000, 60_000, 120_000, 240_000]) {
    expect(pc.delays()).toEqual([wait, 5 * MINUTE].sort((a, b) => a - b))
    await pc.fire(wait)
  }
  expect(pc.delays()).toEqual([5 * MINUTE, 5 * MINUTE])
  google.box.down = null
  await pc.sync.syncNow()
  expect(google.stored()).toBe(driveTextOf(stateWith('MSFT')))
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle' })
  expect(pc.delays()).toEqual([5 * MINUTE])
  google.box.down = 'offline'
  await pc.sync.syncNow()
  expect(pc.delays()).toEqual([30_000, 5 * MINUTE])
})

test('Should say when Google is not answering and try again', async () => {
  const { google, pc } = await synced()
  google.box.down = 'unavailable'
  expect(await pc.sync.syncNow()).toMatchObject({ sync: 'failed' })
  google.box.down = null
  await pc.fire(30_000)
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle' })
})

test('Should get a new access token only when the last one is about to expire', async () => {
  const { google, pc } = await synced()
  pc.clock.at = NOW + 59 * MINUTE - 1
  await pc.sync.syncNow()
  expect(google.refreshes).toEqual([])
  pc.clock.at = NOW + 59 * MINUTE
  await pc.sync.syncNow()
  await pc.sync.syncNow()
  expect(google.refreshes).toEqual(['refresh-secret'])
  expect(pc.tokens.at(-1)).toBe('access-secret-2')
})

test('Should use the saved sign-in after a restart', async () => {
  const google = fakeGoogle()
  google.put(driveTextOf(stateWith('KO')), NOW)
  const pc = computer(google, stateWith('KO'), { email: 'ana@example.com', refreshToken: 'saved-refresh' })
  await pc.sync.start()
  expect(google.refreshes).toEqual(['saved-refresh'])
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle', email: 'ana@example.com' })
})

const expired = async () => {
  const { google, pc } = await synced()
  google.box.expired = true
  pc.clock.at = NOW + 61 * MINUTE
  await pc.sync.syncNow()
  return { google, pc }
}

test('Should forget an expired sign-in and say so, without trying again', async () => {
  const { google, pc } = await expired()
  expect(await pc.sync.status()).toMatchObject({ sync: 'expired', email: 'ana@example.com' })
  expect(pc.account.saved).not.toHaveProperty('refreshToken')
  expect(pc.account.saved).toMatchObject({ email: 'ana@example.com', fileId: 'file-1' })
  expect(pc.delays()).toEqual([5 * MINUTE])
  pc.edit('MSFT')
  await pc.fire(3_000)
  expect(google.refreshes).toHaveLength(1)
  expect(google.uploads).toEqual([])
})

test('Should carry on where it was after signing in again to the same account', async () => {
  const { google, pc } = await expired()
  google.box.expired = false
  pc.edit('MSFT')
  await pc.signIn()
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle' })
  expect(google.stored()).toBe(driveTextOf(stateWith('MSFT')))
})

test('Should start over after signing in to another account', async () => {
  const { google, pc } = await expired()
  google.box.expired = false
  google.box.email = 'luis@example.com'
  google.put(driveTextOf(stateWith('NVDA')), NOW)
  await pc.signIn()
  expect(pc.account.saved).toEqual({
    email: 'luis@example.com',
    refreshToken: 'refresh-secret',
    folderId: 'folder-1',
    fileId: 'file-1',
  })
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose', email: 'luis@example.com', lastSyncAt: null })
})

test('Should keep nothing when the sign-in does not finish', async () => {
  const google = fakeGoogle()
  const pc = computer(google, stateWith('KO'))
  await pc.sync.signIn()
  await expect(pc.sync.finishSignIn(new URLSearchParams({ error: 'access_denied' }))).rejects.toSatisfy(
    (error: unknown) => isGoogleError(error) && error.kind === 'denied',
  )
  google.box.down = 'unavailable'
  await expect(pc.signIn()).rejects.toSatisfy((error: unknown) => isGoogleError(error) && error.kind === 'unavailable')
  expect(pc.account.saved).toBeNull()
  expect(await pc.sync.status()).toMatchObject({ sync: 'signedOut' })
})

test('Should revoke the sign-in and forget it on sign-out, leaving the file in Drive', async () => {
  const { google, pc } = await synced()
  await pc.sync.start()
  expect(await pc.sync.signOut()).toMatchObject({ sync: 'signedOut', email: null, lastSyncAt: null, replacedRev: null })
  expect(google.revoked).toEqual(['refresh-secret'])
  expect(pc.account.saved).toBeNull()
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
  expect(pc.delays()).toEqual([])
  pc.edit('MSFT')
  await pc.fire(3_000)
  expect(google.uploads).toEqual([])
  expect(pc.account.saved).toBeNull()
})

test('Should look at Drive again every five minutes after signing back in', async () => {
  const { pc } = await synced()
  await pc.sync.signOut()
  await pc.signIn()
  expect(pc.delays()).toEqual([5 * MINUTE])
})

test('Should neither save the sign-in nor replace the settings once signed out in the middle of a sync', async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  let open: () => void = () => undefined
  const shut = new Promise<void>((done) => (open = done))
  let calls = 0
  pc.gate.wait = () => ((calls += 1) === 2 ? shut : Promise.resolve())
  const syncing = pc.sync.syncNow()
  await idle()
  await pc.sync.signOut()
  open()
  await syncing
  expect(pc.account.saved).toBeNull()
  expect(pc.local.state?.symbol).toBe('KO')
  expect(pc.replaced).toEqual([])
  expect(await pc.sync.status()).toMatchObject({ sync: 'signedOut' })
  expect(pc.delays()).toEqual([])
})

test('Should not write what a sync of the previous account found into the next sign-in', async () => {
  const { google, pc } = await synced()
  const shut = [0, 1].map(() => {
    let open: () => void = () => undefined
    const wait = new Promise<void>((done) => (open = done))
    return { open, wait }
  })
  let calls = 0
  pc.gate.wait = () => {
    calls += 1
    if (calls === 2) return shut[0].wait
    return calls > 3 ? shut[1].wait : Promise.resolve()
  }
  pc.edit('MSFT')
  await pc.fire(3_000)
  await pc.sync.signOut()
  google.box.email = 'luis@example.com'
  await pc.signIn()
  shut[0].open()
  await idle()
  expect(pc.account.saved).toEqual({ email: 'luis@example.com', refreshToken: 'refresh-secret' })
  shut[1].open()
  await idle()
})

const fromNewerDoji = (symbol: string): string =>
  JSON.stringify({ ...(JSON.parse(driveTextOf(stateWith(symbol))) as object), future: 1 }, null, 2)

test('Should take a copy written by a newer doji once, and then leave Drive alone', async () => {
  const { google, pc } = await synced()
  const newer = fromNewerDoji('NVDA')
  google.put(newer, NOW + MINUTE)
  await pc.sync.syncNow()
  for (let cycle = 0; cycle < 3; cycle += 1) {
    pc.clock.at += 5 * MINUTE
    expect(await pc.sync.syncNow()).toMatchObject({ sync: 'idle', lastSyncAt: new Date(pc.clock.at).toISOString() })
  }
  expect(pc.local.state?.symbol).toBe('NVDA')
  expect(google.uploads).toEqual([])
  expect(google.stored()).toBe(newer)
  expect(pc.replaced).toHaveLength(1)
  expect(pc.copies).toHaveLength(1)
  expect(pc.account.saved).toMatchObject({ syncedHash: hashOf(newer), localHash: hashOf(driveTextOf(stateWith('NVDA'))) })
})

test('Should settle the same way after choosing a copy written by a newer doji', async () => {
  const google = fakeGoogle()
  google.put(fromNewerDoji('NVDA'), NOW - MINUTE)
  const pc = computer(google, stateWith('KO'))
  await pc.signIn()
  await choose(pc, 'drive')
  await pc.sync.syncNow()
  expect(google.uploads).toEqual([])
  expect(pc.replaced).toHaveLength(1)
})

test('Should upload a real change made after taking a copy written by a newer doji', async () => {
  const { google, pc } = await synced()
  google.put(fromNewerDoji('NVDA'), NOW + MINUTE)
  await pc.sync.syncNow()
  pc.edit('TSLA', NOW + 2 * MINUTE)
  await pc.fire(3_000)
  expect(google.uploads).toEqual([driveTextOf(stateWith('TSLA'))])
})

test('Should carry on from a record saved without the hash of this computer', async () => {
  const google = fakeGoogle()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  const record = { email: 'ana@example.com', refreshToken: 'saved-refresh', syncedHash: hashOf(driveTextOf(stateWith('KO'))) }
  const pc = computer(google, stateWith('KO'), record)
  await pc.sync.start()
  expect(pc.local.state?.symbol).toBe('NVDA')
  expect(google.uploads).toEqual([])
})

const held = () => {
  let open: () => void = () => undefined
  const wait = new Promise<void>((done) => (open = done))
  return { open, wait }
}

const watched = <T>(promise: Promise<T>) => {
  const seen = { done: false, value: undefined as T | undefined }
  promise.then((value) => Object.assign(seen, { done: true, value }))
  return seen
}

test('Should bring a newer copy of Drive before saving a change made on stale settings', async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('KO', { notes: { KO: 'from the other computer' } })), NOW + MINUTE)
  pc.clock.at = NOW + 2 * MINUTE
  expect(await pc.change({ symbol: 'MSFT' })).toEqual({ ok: false, reason: 'conflict' })
  expect(pc.local.state).toMatchObject({ symbol: 'KO', notes: { KO: 'from the other computer' } })
  expect(pc.replaced).toEqual([pc.local.state])
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  await pc.fire(3_000)
  expect(google.uploads).toEqual([driveTextOf(stateWith('MSFT', { notes: { KO: 'from the other computer' } }))])
})

test('Should not let the alert monitor of a stale computer undo newer changes', async () => {
  const google = fakeGoogle()
  const expired: HorizontalLine = {
    id: 'a',
    kind: 'hline',
    pane: 'price',
    timeframe: 'D',
    value: 60,
    color: '#FFFFFF',
    width: 2,
    pricedAt: '2026-11-01',
    alert: true,
    alertUntil: '2026-11-26',
  }
  const pc = computer(google, stateWith('KO', { lines: { KO: [expired] } }))
  await pc.signIn()
  google.put(driveTextOf(stateWith('KO', { lines: { KO: [expired] }, notes: { KO: 'newer' } })), NOW + MINUTE)
  pc.clock.at = NOW + 24 * 60 * MINUTE
  const monitor = createAlertMonitor({
    read: pc.saves.read,
    save: pc.saves.save,
    join: () => () => undefined,
    quotes: async () => [],
    announce: () => undefined,
    now: () => new Date(pc.clock.at),
    every: () => () => undefined,
    newId: () => 'event-1',
  })
  await monitor.start()
  await monitor.check({ KO: 55 })
  await idle()
  expect(pc.local.state?.notes).toEqual({ KO: 'newer' })
  expect(pc.local.state?.lines.KO[0]).not.toHaveProperty('alert')
  await pc.fire(3_000)
  const uploaded = JSON.parse(google.stored() as string) as AppState
  expect(uploaded.notes).toEqual({ KO: 'newer' })
  expect(uploaded.lines.KO[0]).not.toHaveProperty('alert')
})

test('Should save at once while Drive was looked at less than a minute ago', async () => {
  const { pc } = await synced()
  const asked = pc.tokens.length
  pc.clock.at = NOW + MINUTE - 1
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  expect(pc.tokens).toHaveLength(asked)
  pc.clock.at = NOW + MINUTE
  expect(await pc.change({ symbol: 'NVDA' })).toMatchObject({ ok: true })
  expect(pc.tokens.length).toBeGreaterThan(asked)
})

test('Should save at once while signed out or while the sign-in expired', async () => {
  const signedOut = computer(fakeGoogle(), stateWith('KO'))
  expect(await signedOut.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  expect(signedOut.tokens).toEqual([])
  const { google, pc } = await expired()
  pc.clock.at += 10 * MINUTE
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  pc.sync.freshen()
  await idle()
  expect(google.refreshes).toHaveLength(1)
})

test('Should save at once while the person has not chosen a copy', async () => {
  const { pc } = await differing()
  const asked = pc.tokens.length
  pc.clock.at = NOW + 10 * MINUTE
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  pc.sync.freshen()
  await idle()
  expect(pc.tokens).toHaveLength(asked)
})

test('Should count the first-time question as a look at Drive', async () => {
  const { google, pc } = await differing()
  pc.clock.at = NOW + 30_000
  await choose(pc, 'drive')
  google.put(driveTextOf(stateWith('TSLA')), NOW + MINUTE)
  const asked = pc.tokens.length
  pc.clock.at = NOW + MINUTE - 1
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  expect(pc.tokens).toHaveLength(asked)
  pc.clock.at = NOW + MINUTE
  expect(await pc.change({ symbol: 'AAPL' })).toEqual({ ok: false, reason: 'conflict' })
})

test('Should save after five seconds when Drive does not answer', async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  const drive = held()
  pc.gate.wait = () => drive.wait
  pc.clock.at = NOW + 2 * MINUTE
  const saving = watched(pc.change({ symbol: 'MSFT' }))
  await idle()
  expect(saving.done).toBe(false)
  await pc.fire(5_000)
  expect(saving).toMatchObject({ done: true, value: { ok: true } })
  expect(pc.local.state?.symbol).toBe('MSFT')
  drive.open()
  await idle()
})

test('Should stop counting the seconds once Drive has answered', async () => {
  const { pc } = await synced()
  pc.clock.at = NOW + 2 * MINUTE
  await pc.change({ symbol: 'MSFT' })
  expect(pc.delays()).toEqual([3_000, 5 * MINUTE])
})

test('Should wait for the look at Drive that is already under way', async () => {
  const google = fakeGoogle()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  const record = { email: 'ana@example.com', refreshToken: 'saved-refresh', syncedHash: hashOf(driveTextOf(stateWith('KO'))) }
  const pc = computer(google, stateWith('KO'), record)
  const drive = held()
  pc.gate.wait = () => drive.wait
  const starting = pc.sync.start()
  await idle()
  const saving = watched(pc.change({ symbol: 'MSFT' }))
  await idle()
  expect(saving.done).toBe(false)
  drive.open()
  await starting
  await idle()
  expect(saving).toMatchObject({ done: true, value: { ok: false, reason: 'conflict' } })
  expect(pc.local.state?.symbol).toBe('NVDA')
})

test('Should look at Drive before saving right after signing in again, however recent the last look', async () => {
  const { pc } = await synced()
  await pc.sync.signOut()
  const drive = held()
  let calls = 0
  pc.gate.wait = () => ((calls += 1) > 1 ? drive.wait : Promise.resolve())
  await pc.signIn()
  const saving = watched(pc.change({ symbol: 'MSFT' }))
  await idle()
  expect(saving.done).toBe(false)
  drive.open()
  await idle()
  expect(saving.done).toBe(true)
})

test('Should save while Drive cannot be reached, trying it no more than every five seconds', async () => {
  const { google, pc } = await synced()
  google.box.down = 'offline'
  const asked = pc.tokens.length
  pc.clock.at = NOW + 2 * MINUTE
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  expect(pc.tokens).toHaveLength(asked + 1)
  pc.clock.at += 4_999
  expect(await pc.change({ symbol: 'NVDA' })).toMatchObject({ ok: true })
  expect(pc.tokens).toHaveLength(asked + 1)
  pc.clock.at += 1
  expect(await pc.change({ symbol: 'TSLA' })).toMatchObject({ ok: true })
  expect(pc.tokens).toHaveLength(asked + 2)
})

test('Should still save when the sync record cannot be written', async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('KO')), NOW + MINUTE)
  google.box.expired = true
  pc.account.refuses = true
  pc.clock.at = NOW + 61 * MINUTE
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
})

test('Should look at Drive in the background at most once a minute, without making anyone wait', async () => {
  const { google, pc } = await synced()
  const asked = pc.tokens.length
  pc.clock.at = NOW + MINUTE - 1
  pc.sync.freshen()
  await idle()
  expect(pc.tokens).toHaveLength(asked)
  google.put(driveTextOf(stateWith('NVDA')), NOW + 30_000)
  const drive = held()
  pc.gate.wait = () => drive.wait
  pc.clock.at = NOW + MINUTE
  expect(pc.sync.freshen()).toBeUndefined()
  pc.sync.freshen()
  await idle()
  pc.clock.at = NOW + 3 * MINUTE
  pc.sync.freshen()
  await idle()
  expect(pc.tokens).toHaveLength(asked + 1)
  expect(pc.local.state?.symbol).toBe('KO')
  drive.open()
  await idle()
  expect(pc.local.state?.symbol).toBe('NVDA')
  expect(pc.tokens).toHaveLength(asked + 2)
  const taken = pc.tokens.length
  pc.sync.freshen()
  await idle()
  expect(pc.tokens).toHaveLength(taken)
  pc.clock.at += MINUTE
  pc.sync.freshen()
  pc.sync.freshen()
  await idle()
  expect(pc.tokens).toHaveLength(taken + 1)
})

test('Should not count a download that a save refused as a look at Drive', async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  pc.local.refusals = 1
  const drive = held()
  pc.gate.wait = () => drive.wait
  pc.clock.at = NOW + 2 * MINUTE
  const syncing = pc.sync.syncNow()
  await idle()
  pc.clock.at += 30_000
  drive.open()
  await syncing
  expect(pc.local.state?.symbol).toBe('KO')
  pc.clock.at = NOW + 3 * MINUTE
  pc.sync.freshen()
  await idle()
  expect(pc.local.state?.symbol).toBe('NVDA')
})

const failedQuickly = async () => {
  const { google, pc } = await synced()
  google.box.down = 'offline'
  pc.clock.at = NOW + 2 * MINUTE
  pc.sync.freshen()
  await idle()
  google.box.down = null
  return { google, pc }
}

test('Should look again before a save five seconds after a quick failure, as when a computer wakes', async () => {
  const { google, pc } = await failedQuickly()
  google.put(driveTextOf(stateWith('KO', { notes: { KO: 'from the other computer' } })), NOW + MINUTE)
  pc.clock.at += 5_000
  expect(await pc.change({ symbol: 'MSFT' })).toEqual({ ok: false, reason: 'conflict' })
  expect(pc.local.state).toMatchObject({ symbol: 'KO', notes: { KO: 'from the other computer' } })
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  await pc.fire(3_000)
  expect(google.uploads).toEqual([driveTextOf(stateWith('MSFT', { notes: { KO: 'from the other computer' } }))])
})

test('Should neither look again nor delay a save right after a quick failure', async () => {
  const { pc } = await failedQuickly()
  const asked = pc.tokens.length
  const drive = held()
  pc.gate.wait = () => drive.wait
  pc.clock.at += 2_000
  const saving = watched(pc.change({ symbol: 'MSFT' }))
  await idle()
  expect(saving).toMatchObject({ done: true, value: { ok: true } })
  expect(pc.tokens).toHaveLength(asked)
})

test.each([
  ['offline', 999, 1],
  ['unavailable', 999, 1],
  ['offline', 1_000, 0],
  ['unavailable', 1_000, 0],
] as const)('Should count an %s failure after %i ms as quick only under a second', async (kind, took, looks) => {
  const { google, pc } = await synced()
  const drive = held()
  pc.gate.wait = () => drive.wait
  google.box.down = kind
  pc.clock.at = NOW + 2 * MINUTE
  pc.sync.freshen()
  await idle()
  pc.clock.at += took
  drive.open()
  await idle()
  const asked = pc.tokens.length
  pc.clock.at += 5_000
  await pc.change({ symbol: 'MSFT' })
  expect(pc.tokens).toHaveLength(asked + looks)
})

test('Should make saves wait for a Drive that is slow to fail only once a minute', async () => {
  const { google, pc } = await synced()
  const drive = held()
  pc.gate.wait = () => drive.wait
  google.box.down = 'offline'
  pc.clock.at = NOW + 2 * MINUTE
  const saving = watched(pc.change({ symbol: 'MSFT' }))
  await idle()
  pc.clock.at += 5_000
  await pc.fire(5_000)
  expect(saving.done).toBe(true)
  pc.clock.at += 3_000
  drive.open()
  await idle()
  pc.gate.wait = () => Promise.resolve()
  const asked = pc.tokens.length
  pc.clock.at += 10_000
  await pc.change({ symbol: 'NVDA' })
  expect(pc.tokens).toHaveLength(asked)
  pc.clock.at += 51_000
  await pc.change({ symbol: 'TSLA' })
  expect(pc.tokens).toHaveLength(asked + 1)
})

test('Should keep the looks in the background a minute apart after a quick failure', async () => {
  const { pc } = await failedQuickly()
  const asked = pc.tokens.length
  pc.clock.at += MINUTE - 1
  pc.sync.freshen()
  await idle()
  expect(pc.tokens).toHaveLength(asked)
  pc.clock.at += 1
  pc.sync.freshen()
  await idle()
  expect(pc.tokens).toHaveLength(asked + 1)
})

test('Should forget a quick failure once this computer and Drive have been compared again', async () => {
  const { google, pc } = await failedQuickly()
  await pc.sync.syncNow()
  google.put(driveTextOf(stateWith('NVDA')), NOW + 3 * MINUTE)
  pc.clock.at += 2 * MINUTE
  pc.local.refusals = 1
  await pc.sync.syncNow()
  const asked = pc.tokens.length
  pc.clock.at += 5_000
  await pc.change({ symbol: 'MSFT' })
  expect(pc.tokens).toHaveLength(asked)
})

test('Should forget a quick failure on signing in again', async () => {
  const { google, pc } = await failedQuickly()
  google.put(driveTextOf(stateWith('NVDA')), NOW + 3 * MINUTE)
  pc.local.refusals = 1
  await pc.signIn()
  const asked = pc.tokens.length
  pc.clock.at += 5_000
  await pc.change({ symbol: 'MSFT' })
  expect(pc.tokens).toHaveLength(asked)
})

test('Should not count a failure of this computer as a quick failure of Drive', async () => {
  const { pc } = await synced()
  pc.account.refuses = true
  pc.clock.at = NOW + 2 * MINUTE
  pc.sync.freshen()
  await idle()
  const asked = pc.tokens.length
  pc.clock.at += 5_000
  await pc.change({ symbol: 'MSFT' })
  expect(pc.tokens).toHaveLength(asked)
})

// What the real store reports for a settings file that holds no readable settings: no time of change, and the defaults.
const breakSettings = (pc: ReturnType<typeof computer>): void => {
  pc.local.state = null
  pc.local.changedAt = null
}

test('Should bring the copy of Drive back to a computer whose settings can no longer be read', async () => {
  const { google, pc } = await synced()
  breakSettings(pc)
  await pc.sync.syncNow()
  expect(google.uploads).toEqual([])
  expect(pc.local.state?.symbol).toBe('KO')
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle', choice: null })
})

test('Should ask before anything saved over unreadable settings while offline replaces the copy of Drive', async () => {
  const { google, pc } = await synced()
  breakSettings(pc)
  google.box.down = 'offline'
  pc.clock.at = NOW + 2 * MINUTE
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  google.box.down = null
  await pc.sync.syncNow()
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([])
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should not take its own uploads for news when Drive sums them its own way', async () => {
  const google = fakeGoogle()
  google.box.checksum = 'drive:'
  const { pc } = await synced(google)
  pc.edit('MSFT')
  await pc.fire(3_000)
  await pc.sync.syncNow()
  await pc.sync.syncNow()
  expect(pc.replaced).toEqual([])
  expect(pc.copies).toEqual([])
  expect(google.uploads).toEqual([driveTextOf(stateWith('MSFT'))])
})

test('Should keep the copy of Drive here before uploading over it when this computer is chosen', async () => {
  const { google, pc } = await differing()
  const theirs = google.stored()
  await choose(pc, 'local')
  expect(pc.kept).toEqual([theirs])
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should keep the copy of Drive here at once when this computer is chosen offline', async () => {
  const { google, pc } = await differing()
  const theirs = google.stored()
  google.box.down = 'offline'
  await choose(pc, 'local')
  expect(pc.kept).toEqual([theirs])
})

test('Should upload nothing and go on asking when the copy of Drive cannot be kept here', async () => {
  const { google, pc } = await differing()
  pc.local.keepFails = true
  await expect(choose(pc, 'local')).rejects.toThrow('disk full')
  expect(google.uploads).toEqual([])
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  pc.local.keepFails = false
  await choose(pc, 'local')
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should not carry an answer into a sign-in made while the copy of Drive was still being kept', async () => {
  const { google, pc } = await differing()
  const disk = held()
  pc.local.keeping = disk.wait
  const choosing = choose(pc, 'local')
  await idle()
  await pc.sync.signOut()
  await pc.signIn()
  disk.open()
  await choosing
  await idle()
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([])
})

test('Should ask, not upload, when settings that were unreadable are written while Drive is being looked at', async () => {
  const { google, pc } = await synced()
  breakSettings(pc)
  const drive = held()
  pc.gate.wait = () => drive.wait
  const syncing = pc.sync.syncNow()
  await idle()
  pc.edit('MSFT')
  drive.open()
  await syncing
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([])
})

test.each(['local', 'drive'] as const)('Should apply nothing when the copy answered about (%s) is no longer the one asked about', async (keep) => {
  const { google, pc } = await differing()
  const shown = (await pc.sync.status()).choice?.id as string
  google.put(driveTextOf(stateWith('TSLA')), NOW + MINUTE)
  const refreshing = pc.sync.syncNow()
  const status = await pc.sync.choose(keep, shown)
  await refreshing
  expect(status).toMatchObject({ sync: 'choose' })
  expect(status.choice?.id).not.toBe(shown)
  expect(pc.local.state?.symbol).toBe('KO')
  expect(pc.kept).toEqual([])
  expect(google.uploads).toEqual([])
  await pc.sync.choose(keep, status.choice?.id as string)
  expect(pc.local.state?.symbol).toBe(keep === 'drive' ? 'TSLA' : 'KO')
})

test('Should send nothing to Drive with a token that arrived after signing out', async () => {
  const { google, pc } = await synced()
  const asked = pc.tokens.length
  const token = held()
  pc.holdRefresh(() => token.wait)
  pc.clock.at = NOW + 61 * MINUTE
  pc.edit('MSFT')
  await pc.fire(3_000)
  await pc.sync.signOut()
  token.open()
  await idle()
  expect(pc.tokens).toHaveLength(asked)
  expect(google.uploads).toEqual([])
})

test('Should not sign back in from a Google page left open when signing out', async () => {
  const pc = computer(fakeGoogle(), stateWith('KO'))
  await pc.sync.signIn()
  expect(await pc.sync.signOut()).toMatchObject({ sync: 'signedOut', signInUrl: null })
  await expect(pc.sync.finishSignIn(new URLSearchParams({ code: 'c1', state: 's1' }))).rejects.toSatisfy(
    (error) => isGoogleError(error) && error.kind === 'invalid_state',
  )
  expect(await pc.sync.status()).toMatchObject({ sync: 'signedOut', email: null })
  expect(pc.account.saved).toBeNull()
})

test('Should bring the copy of Drive back before saving over settings lost since a look just made', async () => {
  const { google, pc } = await synced()
  breakSettings(pc)
  pc.clock.at = NOW + 1_000
  expect(await pc.change({ symbol: 'MSFT' })).toEqual({ ok: false, reason: 'conflict' })
  expect(pc.local.state?.symbol).toBe('KO')
  expect(google.uploads).toEqual([])
})

test('Should ask before uploading what was saved offline over settings lost since a look just made', async () => {
  const { google, pc } = await synced()
  breakSettings(pc)
  google.box.down = 'offline'
  pc.clock.at = NOW + 1_000
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  google.box.down = null
  await pc.fire(3_000)
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
  expect(google.uploads).toEqual([])
})

test('Should still save over lost settings when the sync record cannot be written, and upload nothing by itself', async () => {
  const { google, pc } = await synced()
  breakSettings(pc)
  pc.account.refuses = true
  pc.clock.at = NOW + 1_000
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  await pc.fire(3_000)
  expect(await pc.sync.status()).toMatchObject({ sync: 'failed' })
  expect(google.uploads).toEqual([])
  pc.account.refuses = false
  await pc.sync.syncNow()
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([])
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should not upload on a record that a save cleared after the look had begun', async () => {
  const { google, pc } = await synced()
  breakSettings(pc)
  pc.account.refuses = true
  pc.clock.at = NOW + 1_000
  await pc.change({ symbol: 'MSFT' })
  pc.account.refuses = false
  const timing = held()
  pc.local.timing = timing.wait
  const looking = pc.sync.syncNow()
  await idle()
  const saving = pc.change({ symbol: 'NVDA' })
  await idle()
  timing.open()
  await looking
  await saving
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([])
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should ask, not upload, when settings are lost while a look waits for Drive and something is saved over them', async () => {
  const { google, pc, drive, waited, atOnce } = await hanging()
  pc.sync.freshen()
  await idle()
  breakSettings(pc)
  expect(await atOnce('MSFT')).toBe(false)
  await waited(5_000)
  drive.open()
  await idle()
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([])
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should ask before the next upload when settings are lost while an upload is under way', async () => {
  const { google, pc } = await synced()
  const drive = held()
  let calls = 0
  pc.gate.wait = () => ((calls += 1) === 2 ? drive.wait : Promise.resolve())
  pc.edit('MSFT')
  await pc.fire(3_000)
  breakSettings(pc)
  pc.clock.at = NOW + 1_000
  const saving = watched(pc.change({ symbol: 'NVDA' }))
  await idle()
  await pc.fire(4_000)
  expect(saving.done).toBe(true)
  drive.open()
  await idle()
  await pc.fire(3_000)
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([driveTextOf(stateWith('MSFT'))])
})

test('Should ask nothing after a second save met the settings that were being brought back', async () => {
  const { google, pc } = await synced()
  const drive = held()
  pc.gate.wait = () => drive.wait
  breakSettings(pc)
  pc.clock.at = NOW + 1_000
  const first = watched(pc.change({ symbol: 'MSFT' }))
  await idle()
  const second = watched(pc.change({ symbol: 'NVDA' }))
  await idle()
  drive.open()
  await idle()
  expect([first.value, second.value]).toEqual([
    { ok: false, reason: 'conflict' },
    { ok: false, reason: 'conflict' },
  ])
  expect(await pc.change({ symbol: 'TSLA' })).toMatchObject({ ok: true })
  await pc.fire(3_000)
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle', choice: null })
  expect(google.stored()).toBe(driveTextOf(stateWith('TSLA')))
})

test('Should ask nothing when a new computer is first changed while its settings are first being uploaded', async () => {
  const google = fakeGoogle()
  const pc = computer(google)
  const drive = held()
  let calls = 0
  pc.gate.wait = () => ((calls += 1) === 5 ? drive.wait : Promise.resolve())
  await pc.signIn()
  expect(google.uploads).toEqual([])
  pc.clock.at = NOW + 1_000
  const saving = watched(pc.change({ symbol: 'MSFT' }))
  await idle()
  await pc.fire(4_000)
  expect(saving.done).toBe(true)
  drive.open()
  await idle()
  await pc.fire(3_000)
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle', choice: null })
  expect(google.stored()).toBe(driveTextOf(stateWith('MSFT')))
})

test('Should ask nothing at the first change on a computer that signed in with no settings', async () => {
  const google = fakeGoogle()
  const pc = computer(google)
  await pc.signIn()
  pc.clock.at = NOW + 1_000
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  await pc.fire(3_000)
  expect(await pc.sync.status()).toMatchObject({ sync: 'idle', choice: null })
  expect(google.stored()).toBe(driveTextOf(stateWith('MSFT')))
})

test('Should compare the settings with the time of change seen together with them', async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  pc.edit('MSFT', NOW + 2 * MINUTE)
  pc.local.reportedTime = NOW - MINUTE
  await pc.sync.syncNow()
  expect(pc.local.state?.symbol).toBe('MSFT')
  expect(google.stored()).toBe(driveTextOf(stateWith('MSFT')))
})

// A sync under way that has begun to replace the settings of this computer with a newer copy of Drive.
const replacingNow = async () => {
  const { google, pc } = await synced()
  google.put(driveTextOf(stateWith('NVDA')), NOW + MINUTE)
  let open: () => void = () => undefined
  let fail: () => void = () => undefined
  pc.local.replacing = new Promise<void>((done, reject) => {
    open = done
    fail = () => reject(new Error('disk full'))
  })
  const syncing = pc.sync.syncNow()
  await idle()
  return { google, pc, syncing, open, fail }
}

test('Should finish replacing the settings before signing out, so that nothing changes once signed out', async () => {
  const { pc, syncing, open } = await replacingNow()
  const leaving = watched(pc.sync.signOut())
  await idle()
  expect(leaving.done).toBe(false)
  open()
  await syncing
  await idle()
  expect(leaving.value).toMatchObject({ sync: 'signedOut', replacedRev: null })
  expect(pc.local.state?.symbol).toBe('NVDA')
  expect(pc.account.saved).toBeNull()
})

test('Should finish replacing the settings before another account signs in', async () => {
  const { google, pc, syncing, open } = await replacingNow()
  google.box.email = 'bo@example.com'
  await pc.sync.signIn()
  const entering = watched(pc.sync.finishSignIn(new URLSearchParams({ code: 'c2', state: 's1' })).then(() => true))
  await idle()
  expect(entering.done).toBe(false)
  expect(pc.account.saved).toMatchObject({ email: 'ana@example.com' })
  open()
  await syncing
  await idle()
  expect(entering.done).toBe(true)
  expect(pc.local.state?.symbol).toBe('NVDA')
  expect(pc.account.saved).toMatchObject({ email: 'bo@example.com' })
})

test('Should still sign out when the settings being replaced cannot be written', async () => {
  const { pc, syncing, fail } = await replacingNow()
  const leaving = watched(pc.sync.signOut())
  await idle()
  fail()
  await syncing
  await idle()
  expect(leaving.value).toMatchObject({ sync: 'signedOut' })
  expect(pc.account.saved).toBeNull()
  expect(pc.local.state?.symbol).toBe('KO')
})

// Settings lost, and something saved over them, somewhere between asking the question and acting on its answer.
const loseAndSave = async (pc: ReturnType<typeof computer>) => {
  breakSettings(pc)
  return pc.change({ symbol: 'MSFT' })
}

test.each([
  [
    'after the answer, before Drive could be reached',
    async () => {
      const { google, pc } = await differing()
      google.box.down = 'offline'
      await choose(pc, 'local')
      await loseAndSave(pc)
      google.box.down = null
      await pc.sync.syncNow()
      return { google, pc }
    },
  ],
  [
    'while the question waits',
    async () => {
      const { google, pc } = await differing()
      await loseAndSave(pc)
      await choose(pc, 'local')
      return { google, pc }
    },
  ],
  [
    'while the copy of Drive is being kept',
    async () => {
      const { google, pc } = await differing()
      const disk = held()
      pc.local.keeping = disk.wait
      const answering = choose(pc, 'local')
      await idle()
      await loseAndSave(pc)
      disk.open()
      await answering
      return { google, pc }
    },
  ],
  [
    'while the question was being asked',
    async () => {
      const google = fakeGoogle()
      google.put(driveTextOf(stateWith('NVDA')), NOW - 2 * MINUTE)
      const pc = computer(google, stateWith('KO', { rev: 4 }))
      const download = held()
      let calls = 0
      pc.gate.wait = () => ((calls += 1) === 4 ? download.wait : Promise.resolve())
      await pc.signIn()
      const saving = loseAndSave(pc)
      await idle()
      await pc.fire(5_000)
      await saving
      download.open()
      await idle()
      await choose(pc, 'local')
      return { google, pc }
    },
  ],
])('Should ask again, not upload, when settings are lost %s', async (_when, scenario) => {
  const { google, pc } = await scenario()
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([])
  expect(google.stored()).toBe(driveTextOf(stateWith('NVDA')))
  // Asked about what is here now, the same answer counts.
  expect(await choose(pc, 'local')).toMatchObject({ sync: 'idle' })
  expect(google.stored()).toBe(driveTextOf(stateWith('MSFT')))
})

test('Should keep distrusting the last sync while its record cannot be read', async () => {
  const { google, pc } = await synced()
  pc.account.failReads = Infinity
  breakSettings(pc)
  pc.clock.at = NOW + 1_000
  expect(await pc.change({ symbol: 'MSFT' })).toMatchObject({ ok: true })
  pc.account.failReads = 0
  await pc.sync.syncNow()
  expect(await pc.sync.status()).toMatchObject({ sync: 'choose' })
  expect(google.uploads).toEqual([])
  expect(google.stored()).toBe(driveTextOf(stateWith('KO')))
})

test('Should not take a record that cannot be read for a sign-in that ended', async () => {
  const pc = computer(fakeGoogle(), stateWith('KO'), { email: 'ana@example.com', refreshToken: 'saved-refresh' })
  pc.account.beforeToken = () => {
    pc.account.beforeToken = () => undefined
    pc.account.failReads = 1
  }
  await pc.sync.syncNow()
  expect(await pc.sync.status()).toMatchObject({ sync: 'failed' })
  expect(pc.account.saved).toMatchObject({ refreshToken: 'saved-refresh' })
})

// A computer whose Drive stops answering: every look hangs until released.
const hanging = async () => {
  const { google, pc } = await synced()
  const drive = held()
  pc.gate.wait = () => drive.wait
  pc.clock.at = NOW + 2 * MINUTE
  const waited = async (ms: number) => {
    pc.clock.at += ms
    await pc.fire(ms)
  }
  const atOnce = async (symbol: string) => {
    const saving = watched(pc.change({ symbol }))
    await idle()
    return saving.done
  }
  return { google, pc, drive, waited, atOnce }
}

test('Should not make saves wait for a minute once one has waited for Drive in vain', async () => {
  const { google, pc, drive, waited, atOnce } = await hanging()
  google.put(driveTextOf(stateWith('NVDA')), NOW + 3 * MINUTE)
  pc.local.refusals = 1
  expect(await atOnce('MSFT')).toBe(false)
  await waited(5_000)
  drive.open()
  await idle()
  const next = held()
  pc.gate.wait = () => next.wait
  await pc.fire(3_000)
  pc.clock.at += 1_000
  expect(await atOnce('TSLA')).toBe(true)
})

test('Should make a save wait only what is left of the five seconds of a look already under way', async () => {
  const { pc, waited, atOnce } = await hanging()
  pc.sync.freshen()
  await idle()
  pc.clock.at += 2_000
  expect(await atOnce('MSFT')).toBe(false)
  expect(pc.delays()).toContain(3_000)
  await waited(3_000)
  expect(pc.local.state?.symbol).toBe('MSFT')
})

test('Should not make a save wait for a look that has been under way five seconds', async () => {
  const { pc, atOnce } = await hanging()
  pc.sync.freshen()
  await idle()
  pc.clock.at += 5_000
  expect(await atOnce('MSFT')).toBe(true)
})

test('Should make a save wait again a minute after one waited in vain', async () => {
  const { google, pc, drive, waited, atOnce } = await hanging()
  google.box.down = 'offline'
  expect(await atOnce('MSFT')).toBe(false)
  await waited(5_000)
  drive.open()
  await idle()
  const later = held()
  pc.gate.wait = () => later.wait
  pc.clock.at += MINUTE
  expect(await atOnce('NVDA')).toBe(false)
})

test('Should not make saves wait for a minute after Drive was slow to fail in the background', async () => {
  const { google, pc, drive, atOnce } = await hanging()
  google.box.down = 'unavailable'
  pc.sync.freshen()
  await idle()
  pc.clock.at += 2_000
  drive.open()
  await idle()
  const retry = held()
  pc.gate.wait = () => retry.wait
  pc.clock.at += 30_000
  await pc.fire(30_000)
  expect(await atOnce('MSFT')).toBe(true)
})

test('Should make saves wait again after signing in again, however recently one waited in vain', async () => {
  const { pc, drive, waited, atOnce } = await hanging()
  expect(await atOnce('MSFT')).toBe(false)
  await waited(5_000)
  drive.open()
  await idle()
  await pc.sync.signOut()
  const next = held()
  let calls = 0
  pc.gate.wait = () => ((calls += 1) > 1 ? next.wait : Promise.resolve())
  await pc.signIn()
  expect(await atOnce('NVDA')).toBe(false)
})

test('Should not hold a failure of this computer against Drive, however long it took', async () => {
  const { pc, drive, atOnce } = await hanging()
  pc.account.refuses = true
  pc.sync.freshen()
  await idle()
  pc.clock.at += 2_000
  drive.open()
  await idle()
  const retry = held()
  pc.gate.wait = () => retry.wait
  pc.clock.at += 30_000
  await pc.fire(30_000)
  expect(await atOnce('MSFT')).toBe(false)
})

test('Should not hold against a new sign-in a wait begun before it', async () => {
  const { pc, drive, waited, atOnce } = await hanging()
  expect(await atOnce('MSFT')).toBe(false)
  pc.gate.wait = () => Promise.resolve()
  await pc.sync.signOut()
  await pc.signIn()
  const next = held()
  pc.gate.wait = () => next.wait
  await waited(5_000)
  drive.open()
  await idle()
  expect(await atOnce('NVDA')).toBe(false)
})

// A computer over a real settings file, so that its revisions are the ones its pages are given.
const onDisk = async (google: Google) => {
  const file = join(await mkdtemp(join(tmpdir(), 'doji-sync-')), 'state.json')
  const clock = { at: NOW }
  const store = createStateStore(file, () => new Date(clock.at))
  let account: unknown = null
  const { auth } = fakeAuth(google, clock)
  const sync = createGoogleSync({
    client: CLIENT,
    auth,
    makeDrive: (token) => google.drive(token, async () => undefined),
    local: store,
    store: {
      load: async () => account,
      save: async (data) => {
        account = JSON.parse(JSON.stringify(data))
      },
      clear: async () => {
        account = null
      },
    },
    onReplaced: () => undefined,
    now: () => clock.at,
    setTimer: () => null,
    clearTimer: () => undefined,
  })
  const saves = trackSaves(store, { beforeSave: () => sync.beforeSave(), saved: () => sync.localChanged() })
  await sync.signIn()
  await sync.finishSignIn(new URLSearchParams({ code: 'c1', state: 's1' }))
  await sync.syncNow()
  return { file, clock, store, sync, saves }
}

test.each([
  ['deleted', (file: string) => rm(file)],
  ['broken', (file: string) => writeFile(file, '{ oops')],
  ['emptied', (file: string) => writeFile(file, '{}')],
])('Should refuse the save of an open page over %s settings and keep the newer copy of Drive', async (_name, lose) => {
  const google = fakeGoogle()
  google.put(driveTextOf(stateWith('KO')), NOW - MINUTE)
  const pc = await onDisk(google)
  const newer = driveTextOf(stateWith('KO', { notes: { KO: 'from the other computer' } }))
  // Once for a computer just set up, and again for a page showing what was brought back the first time.
  for (let loss = 1; loss <= 2; loss += 1) {
    const shown = await pc.saves.read()
    google.put(newer, pc.clock.at + 1_000)
    await lose(pc.file)
    pc.clock.at += 2_000
    expect(await pc.saves.save({ ...shown, symbol: 'MSFT' }, shown.rev)).toEqual({ ok: false, reason: 'conflict' })
    expect(google.stored()).toBe(newer)
    expect(await pc.saves.read()).toMatchObject({ symbol: 'KO', notes: { KO: 'from the other computer' } })
  }
})

test('Should stop looking when stopped', async () => {
  const { pc } = await synced()
  await pc.sync.start()
  pc.edit('MSFT')
  pc.sync.stop()
  expect(pc.delays()).toEqual([])
})
