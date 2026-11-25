import type { Holding } from './types'

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

export const isHolding = (value: unknown): value is Holding => {
  const holding = value as Partial<Holding> | null
  return typeof holding === 'object' && holding !== null && positive(holding.quantity) && positive(holding.price)
}

export const toHoldings = (raw: unknown): Record<string, Holding> =>
  raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(
        Object.entries(raw).flatMap(([symbol, holding]) => (isHolding(holding) ? [[symbol, { quantity: holding.quantity, price: holding.price }]] : [])),
      )
    : {}
