import type { Bar } from '../../shared/types'
import { mondayOf } from '../../shared/dates'

export const toWeekly = (bars: Bar[]): Bar[] => {
  const weeks: Bar[] = []
  let currentMonday = ''
  bars.forEach((bar) => {
    const monday = mondayOf(bar.time)
    const last = weeks.at(-1)
    if (!last || monday !== currentMonday) {
      currentMonday = monday
      weeks.push({ ...bar })
      return
    }
    last.high = Math.max(last.high, bar.high)
    last.low = Math.min(last.low, bar.low)
    last.close = bar.close
    last.volume += bar.volume
  })
  return weeks
}
