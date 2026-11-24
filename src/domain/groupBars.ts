import type { Bar } from '../../shared/types'

export const groupBars = (bars: Bar[], keyOf: (date: string) => string): Bar[] => {
  const groups: Bar[] = []
  let currentKey = ''
  bars.forEach((bar) => {
    const key = keyOf(bar.time)
    const last = groups.at(-1)
    if (!last || key !== currentKey) {
      currentKey = key
      groups.push({ ...bar })
      return
    }
    last.high = Math.max(last.high, bar.high)
    last.low = Math.min(last.low, bar.low)
    last.close = bar.close
    last.volume += bar.volume
  })
  return groups
}
