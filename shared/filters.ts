import { LIST_NAME_MAX_LENGTH, MAX_FILTERS, MAX_FILTER_CONDITIONS } from './limits'
import type { FilterCondition, FilterField, SavedFilter } from './types'

export const FILTER_FIELDS: FilterField[] = ['change', 'rsi', 'fromHigh', 'relVolume', 'level', 'vsSma50', 'vsSma200', 'earningsDays']

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const toCondition = (raw: unknown): FilterCondition[] => {
  const condition = record(raw)
  const field = FILTER_FIELDS.find((option) => option === condition.field)
  const { op, value } = condition
  if (!field || (op !== 'above' && op !== 'below') || typeof value !== 'number' || !Number.isFinite(value)) return []
  return [{ field, op, value }]
}

const toFilter = (raw: unknown): SavedFilter[] => {
  const filter = record(raw)
  const id = typeof filter.id === 'string' ? filter.id : ''
  const name = typeof filter.name === 'string' ? filter.name.trim().slice(0, LIST_NAME_MAX_LENGTH) : ''
  const conditions = (Array.isArray(filter.conditions) ? filter.conditions.flatMap(toCondition) : []).slice(0, MAX_FILTER_CONDITIONS)
  if (!id || !name || conditions.length === 0) return []
  return [{ id, name, scope: filter.scope === 'all' ? 'all' : 'list', conditions }]
}

export const toFilters = (raw: unknown): SavedFilter[] => (Array.isArray(raw) ? raw.flatMap(toFilter).slice(0, MAX_FILTERS) : [])
