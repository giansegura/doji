import { monthStartOf } from '../../shared/dates'
import type { Bar } from '../../shared/types'
import { groupBars } from './groupBars'

export const toMonthly = (bars: Bar[]): Bar[] => groupBars(bars, monthStartOf)
