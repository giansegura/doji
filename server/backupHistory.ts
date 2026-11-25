import type { History } from '../shared/types'
import type { BackupSource } from './provider/twelveData'
import { isProviderError } from './provider/yahoo'

export type BackupHistory = { serve: (symbol: string, primary: () => Promise<History>) => Promise<History> }

type Kept = { at: number; history: History }

const FAILURES_BEFORE_BACKUP = 3
const KEEP_MS = 15 * 60_000

export const createBackupHistory = (deps: { backup: BackupSource; now: () => Date }): BackupHistory => {
  const kept = new Map<string, Kept>()
  let failures = 0

  const fromBackup = async (symbol: string): Promise<History | null> => {
    const key = symbol.toUpperCase()
    const known = kept.get(key)
    const now = deps.now().getTime()
    if (known && now - known.at < KEEP_MS) return known.history
    try {
      const history = await deps.backup.history(symbol)
      kept.set(key, { at: now, history })
      return history
    } catch {
      return null
    }
  }

  const serve = async (symbol: string, primary: () => Promise<History>): Promise<History> => {
    let answer: History | null = null
    let failure: unknown = null
    try {
      answer = await primary()
    } catch (error) {
      failure = error
    }
    if (answer && !answer.stale) {
      failures = 0
      return answer
    }
    if (failure && isProviderError(failure) && failure.kind === 'not_found') throw failure
    failures += 1
    const backup = failures >= FAILURES_BEFORE_BACKUP ? await fromBackup(symbol) : null
    if (backup) return backup
    if (answer) return answer
    throw failure
  }

  return { serve }
}
