import { normalizeState } from '../../shared/normalizeState'
import type { AppState } from '../../shared/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const configFileName = (day: string): string => `doji-config-${day}.json`

export const serializeConfig = (state: AppState): string => {
  const { rev: _rev, ...content } = state
  return JSON.stringify(content, null, 2)
}

export const parseConfig = (text: string): AppState | null => {
  const raw = readJson(text)
  if (!isRecord(raw) || !Array.isArray(raw.watchlists) || !isRecord(raw.lines)) return null
  return normalizeState(raw)
}
