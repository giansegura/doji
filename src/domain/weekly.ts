import { mondayOf } from '../../shared/dates'
import type { Bar } from '../../shared/types'
import { groupBars } from './groupBars'

export const toWeekly = (bars: Bar[]): Bar[] => groupBars(bars, mondayOf)
