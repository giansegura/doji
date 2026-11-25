import { TWELVE_DATA } from './provider/twelveData'

export type BackupStatus = { configured: boolean; source: string }

export type BackupKeyStore = { load: () => Promise<unknown>; save: (data: { key: string }) => Promise<void>; clear: () => Promise<void> }

export type BackupKey = {
  status: () => Promise<BackupStatus>
  set: (key: string) => Promise<BackupStatus>
  clear: () => Promise<BackupStatus>
  get: () => Promise<string | null>
}

const KEY = /^[A-Za-z0-9]{16,64}$/
const ERROR_NAME = 'BackupKeyError'

export const isBackupKeyError = (error: unknown): boolean => error instanceof Error && error.name === ERROR_NAME

export const createBackupKey = (deps: { store: BackupKeyStore }): BackupKey => {
  const get = async (): Promise<string | null> => {
    const saved = (await deps.store.load().catch(() => null)) as { key?: unknown } | null
    return typeof saved?.key === 'string' && KEY.test(saved.key) ? saved.key : null
  }

  const status = async (): Promise<BackupStatus> => ({ configured: (await get()) !== null, source: TWELVE_DATA })

  const set = async (key: string): Promise<BackupStatus> => {
    const clean = key.trim()
    if (!KEY.test(clean)) throw Object.assign(new Error('invalid_key'), { name: ERROR_NAME })
    await deps.store.save({ key: clean })
    return status()
  }

  const clear = async (): Promise<BackupStatus> => {
    await deps.store.clear()
    return status()
  }

  return { status, set, clear, get }
}
