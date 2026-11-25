import type { FlagColor } from './types'

export const FLAG_COLORS: FlagColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

export const isFlagColor = (value: unknown): value is FlagColor => FLAG_COLORS.some((color) => color === value)

export const toFlags = (raw: unknown): Record<string, FlagColor> =>
  raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, FlagColor] => isFlagColor(entry[1])))
    : {}
