import type { Position } from '../../shared/types'

export type PositionReading = {
  targetPercent: number
  stopPercent: number
  rewardToRisk: number
  shares: number | null
  risk: number | null
}

const percentFrom = (entry: number, price: number): number => (entry !== 0 ? ((price - entry) / entry) * 100 : 0)

export const positionReading = (position: Position): PositionReading => {
  const entry = position.p1.value
  const perShare = Math.abs(entry - position.stop)
  const reward = Math.abs(position.target - entry)
  const risk = position.account && position.riskPercent ? (position.account * position.riskPercent) / 100 : null
  return {
    targetPercent: percentFrom(entry, position.target),
    stopPercent: percentFrom(entry, position.stop),
    rewardToRisk: perShare > 0 ? reward / perShare : 0,
    shares: risk !== null && perShare > 0 ? Math.floor(risk / perShare) : null,
    risk,
  }
}
