import { LIST_DEFAULT_WIDTH, LIST_MAX_WIDTH, LIST_MIN_WIDTH, WATCH_COLUMN_WIDTH } from './limits'

export const listMaxWidth = (extraColumns: number): number => LIST_MAX_WIDTH + extraColumns * WATCH_COLUMN_WIDTH

export const clampListWidth = (width: number, extraColumns = 0): number =>
  Math.min(listMaxWidth(extraColumns), Math.max(LIST_MIN_WIDTH, Math.round(width)))

export const toListWidth = (value: unknown, extraColumns = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? clampListWidth(value, extraColumns) : LIST_DEFAULT_WIDTH
