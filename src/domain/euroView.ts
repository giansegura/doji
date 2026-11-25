import { convertPrice } from '../../shared/currency'
import type { Bar } from '../../shared/types'
import type { LivePrice } from './liveBar'

export const euroLive = (live: LivePrice | null, fx: Bar[], factor: number): LivePrice | null => {
  if (!live) return null
  const price = convertPrice(live.price, fx, factor)
  if (price === null) return null
  const high = live.high === undefined ? null : convertPrice(live.high, fx, factor)
  const low = live.low === undefined ? null : convertPrice(live.low, fx, factor)
  return { ...live, price, ...(high === null ? {} : { high }), ...(low === null ? {} : { low }) }
}
