import { access, copyFile, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { normalizeState } from '../shared/normalizeState'
import type { AppState } from '../shared/types'
import { writeAtomic } from './atomicWrite'

export type SaveOutcome = { ok: true; rev: number } | { ok: false; reason: 'conflict' }

export type StateStore = {
  read: () => Promise<AppState>
  save: (state: AppState, baseRev: number) => Promise<SaveOutcome>
}

export type LocalStateFile = StateStore & {
  replace: (state: AppState, baseRev: number) => Promise<SaveOutcome>
  // Keeps settings from elsewhere, as they came, among the copies of what was replaced.
  keepCopy: (text: string) => Promise<void>
  // Null when there is no file, or none that can be read as settings.
  changedAt: () => Promise<number | null>
  // The settings and the time they changed as they stand together, with no save in between.
  snapshot: () => Promise<{ state: AppState; changedAt: number | null }>
}

const BACKUPS_KEPT = 7
const REPLACED_KEPT = 10

const isMissing = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === 'ENOENT'

const twoDigits = (value: number): string => String(value).padStart(2, '0')

const localDay = (date: Date): string =>
  `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`

const localTime = (date: Date): string => [date.getHours(), date.getMinutes(), date.getSeconds()].map(twoDigits).join('')

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  )

const asRegExpText = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const byAge = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true })

const holdsSettings = (text: string): boolean => {
  try {
    const raw: unknown = JSON.parse(text)
    // An empty object holds none either: doji never writes one.
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.keys(raw).length > 0
  } catch {
    return false
  }
}

const savedOnOf = (text: string): string | null => {
  try {
    const savedOn = (JSON.parse(text) as { savedOn?: unknown } | null)?.savedOn
    return typeof savedOn === 'string' && savedOn.length > 0 ? savedOn : null
  } catch {
    return null
  }
}

export const createStateStore = (file: string, now: () => Date = () => new Date()): LocalStateFile => {
  const dir = dirname(file)
  const backupPrefix = `${basename(file)}.bak-`
  const replacedPattern = new RegExp(`^${asRegExpText(backupPrefix)}\\d{4}-\\d{2}-\\d{2}-\\d{6}(-\\d+)?$`)
  let queue: Promise<unknown> = Promise.resolve()

  const readText = async (): Promise<string | null> => {
    try {
      return await readFile(file, 'utf8')
    } catch (error) {
      if (isMissing(error)) return null
      throw error
    }
  }

  const parse = async (text: string | null): Promise<AppState> => {
    if (text === null) return normalizeState(null)
    try {
      return normalizeState(JSON.parse(text))
    } catch {
      await copyFile(file, `${file}.corrupt-${Date.now()}`).catch(() => undefined)
      return normalizeState(null)
    }
  }

  const read = async (): Promise<AppState> => parse(await readText())

  // The next copy made at the same second takes a higher number, so it never looks older than the ones before it.
  const replacedName = async (stem: string): Promise<string> => {
    const taken = (await readdir(dir))
      .filter((entry) => entry === stem || entry.startsWith(`${stem}-`))
      .map((entry) => Number(entry.slice(stem.length + 1)) || 1)
    return taken.length === 0 ? stem : `${stem}-${Math.max(...taken) + 1}`
  }

  const keepNewest = async (copies: string[], kept: number): Promise<void> => {
    await Promise.all(copies.sort(byAge).slice(0, -kept).map((entry) => rm(join(dir, entry), { force: true })))
  }

  const copiesKept = async (): Promise<string[]> => (await readdir(dir)).filter((entry) => entry.startsWith(backupPrefix))

  const rotate = async (): Promise<void> => {
    const copies = await copiesKept()
    await keepNewest(copies.filter((entry) => replacedPattern.test(entry)), REPLACED_KEPT)
    await keepNewest(copies.filter((entry) => !replacedPattern.test(entry)), BACKUPS_KEPT)
  }

  // A clock that goes back, as when summer time ends, must not make a new copy look older than the ones kept: it
  // takes the latest name among them and the next number.
  const timedName = async (moment: Date): Promise<string> => {
    const stem = `${backupPrefix}${localDay(moment)}-${localTime(moment)}`
    const latest = (await readdir(dir)).filter((entry) => replacedPattern.test(entry)).sort(byAge).at(-1)
    const kept = latest?.slice(0, stem.length)
    return replacedName(kept && byAge(kept, stem) > 0 ? kept : stem)
  }

  const backUp = async (moment: Date, always: boolean): Promise<void> => {
    const daily = `${backupPrefix}${localDay(moment)}`
    const taken = await exists(join(dir, daily))
    if (taken && !always) return
    // What is replaced takes a timed name too when a later day has a copy, as after the clock went back: rotation
    // would count a daily copy for this day among the oldest and could drop it at once.
    const late = always && (await copiesKept()).some((entry) => !replacedPattern.test(entry) && byAge(entry, daily) > 0)
    await copyFile(file, join(dir, taken || late ? await timedName(moment) : daily))
    await rotate()
  }

  const persist = async (state: AppState, baseRev: number, replacing: boolean): Promise<SaveOutcome> => {
    const text = await readText()
    const current = await parse(text)
    if (baseRev !== current.rev) return { ok: false, reason: 'conflict' }
    const moment = now()
    const today = localDay(moment)
    // A copy brought from elsewhere takes a revision no open page can hold. Counting on from the file is not enough:
    // lost settings read as revision 1, so the count would pass again through revisions pages were already given.
    const rev = replacing ? Math.max(current.rev + 1, moment.getTime()) : current.rev + 1
    await mkdir(dir, { recursive: true })
    if (text !== null && (replacing || savedOnOf(text) !== today)) await backUp(moment, replacing)
    await writeAtomic(file, JSON.stringify({ ...normalizeState(state), rev, savedOn: today }, null, 2))
    return { ok: true, rev }
  }

  const queued = <T>(work: () => Promise<T>): Promise<T> => {
    const run = queue.then(work, work)
    queue = run.catch(() => undefined)
    return run
  }

  const keepCopy = (text: string): Promise<void> =>
    queued(async () => {
      await mkdir(dir, { recursive: true })
      await writeAtomic(join(dir, await timedName(now())), text)
      await rotate()
    })

  const changedAt = async (): Promise<number | null> => {
    try {
      const { mtimeMs } = await stat(file)
      // The defaults read in place of unreadable settings must never pass for this computer's.
      return holdsSettings(await readFile(file, 'utf8')) ? mtimeMs : null
    } catch (error) {
      if (isMissing(error)) return null
      throw error
    }
  }

  const snapshot = () => queued(async () => ({ changedAt: await changedAt(), state: await read() }))

  return {
    read,
    save: (state, baseRev) => queued(() => persist(state, baseRev, false)),
    replace: (state, baseRev) => queued(() => persist(state, baseRev, true)),
    keepCopy,
    changedAt,
    snapshot,
  }
}
