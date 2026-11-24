import {
  MAX_SMAS,
  SMA_COLORS,
  SMA_MAX_LENGTH,
  SMA_MAX_WIDTH,
  SMA_MIN_LENGTH,
  SMA_MIN_WIDTH,
} from '../../shared/limits'
import type { SmaConfig } from '../../shared/types'

export const SMA_WIDTHS = [1, 2, 3, 4]

const USUAL_LENGTHS = [20, 50, 200, 100, 10, 150]

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.floor(value)))

export const clampSmaLength = (length: number): number => clamp(length, SMA_MIN_LENGTH, SMA_MAX_LENGTH)

export const clampSmaWidth = (width: number): number => clamp(width, SMA_MIN_WIDTH, SMA_MAX_WIDTH)

export const addSma = (list: SmaConfig[], newId: () => string): SmaConfig[] => {
  if (list.length >= MAX_SMAS) return list
  const length = USUAL_LENGTHS.find((usual) => !list.some((item) => item.length === usual)) ?? USUAL_LENGTHS[0]
  const color = SMA_COLORS.find((option) => !list.some((item) => item.color === option)) ?? SMA_COLORS[0]
  return [...list, { id: newId(), length, color, width: SMA_MIN_WIDTH }]
}
