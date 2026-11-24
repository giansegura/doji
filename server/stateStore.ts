import { access, copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { normalizeState } from '../shared/normalizeState'
import type { AppState } from '../shared/types'
import { writeAtomic } from './atomicWrite'

export type SaveOutcome = { ok: true; rev: number } | { ok: false; reason: 'conflict' }

export type StateStore = {
  read: () => Promise<AppState>
  save: (state: AppState, baseRev: number) => Promise<SaveOutcome>
}

const BACKUPS_KEPT = 7

const isMissing = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === 'ENOENT'

const twoDigits = (value: number): string => String(value).padStart(2, '0')

const localDay = (date: Date): string =>
  `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`

const savedOnOf = (text: string): string | null => {
  try {
    const savedOn = (JSON.parse(text) as { savedOn?: unknown } | null)?.savedOn
    return typeof savedOn === 'string' && savedOn.length > 0 ? savedOn : null
  } catch {
    return null
  }
}

export const createStateStore = (file: string, now: () => Date = () => new Date()): StateStore => {
  const dir = dirname(file)
  const backupPrefix = `${basename(file)}.bak-`
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

  const backUp = async (today: string): Promise<void> => {
    const backup = `${file}.bak-${today}`
    const exists = await access(backup).then(
      () => true,
      () => false,
    )
    if (exists) return
    await copyFile(file, backup)
    const backups = (await readdir(dir)).filter((entry) => entry.startsWith(backupPrefix)).sort()
    await Promise.all(backups.slice(0, -BACKUPS_KEPT).map((entry) => rm(join(dir, entry), { force: true })))
  }

  const persist = async (state: AppState, baseRev: number): Promise<SaveOutcome> => {
    const text = await readText()
    const current = await parse(text)
    if (baseRev !== current.rev) return { ok: false, reason: 'conflict' }
    const today = localDay(now())
    const rev = current.rev + 1
    await mkdir(dir, { recursive: true })
    if (text !== null && savedOnOf(text) !== today) await backUp(today)
    await writeAtomic(file, JSON.stringify({ ...normalizeState(state), rev, savedOn: today }, null, 2))
    return { ok: true, rev }
  }

  const save = (state: AppState, baseRev: number): Promise<SaveOutcome> => {
    const run = queue.then(
      () => persist(state, baseRev),
      () => persist(state, baseRev),
    )
    queue = run.catch(() => undefined)
    return run
  }

  return { read, save }
}
