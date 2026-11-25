import type { WatchColumn } from './types'

export const WATCH_COLUMNS: WatchColumn[] = ['rsi', 'fromHigh', 'relVolume', 'earnings', 'level']

export const isWatchColumn = (value: unknown): value is WatchColumn => WATCH_COLUMNS.some((column) => column === value)

export const toWatchColumns = (raw: unknown): WatchColumn[] =>
  Array.isArray(raw) ? WATCH_COLUMNS.filter((column) => raw.includes(column)) : []
