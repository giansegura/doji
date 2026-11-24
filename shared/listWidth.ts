import { LIST_DEFAULT_WIDTH, LIST_MAX_WIDTH, LIST_MIN_WIDTH } from './limits'

export const clampListWidth = (width: number): number =>
  Math.min(LIST_MAX_WIDTH, Math.max(LIST_MIN_WIDTH, Math.round(width)))

export const toListWidth = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? clampListWidth(value) : LIST_DEFAULT_WIDTH
