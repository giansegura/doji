import type { SymbolInfo } from '../shared/types'
import { isProviderError } from './provider/yahoo'

const WORKERS = 4

const firstKnown = async (candidates: string[], lookup: (symbol: string) => Promise<SymbolInfo>): Promise<SymbolInfo | null> => {
  for (const candidate of candidates) {
    try {
      return await lookup(candidate)
    } catch (error) {
      if (!isProviderError(error) || error.kind !== 'not_found') throw error
    }
  }
  return null
}

export const resolveSymbols = async (
  groups: string[][],
  lookup: (symbol: string) => Promise<SymbolInfo>,
  workers = WORKERS,
): Promise<(SymbolInfo | null)[]> => {
  const found: (SymbolInfo | null)[] = groups.map(() => null)
  let next = 0
  const work = async (): Promise<void> => {
    while (next < groups.length) {
      const index = next
      next += 1
      found[index] = await firstKnown(groups[index], lookup)
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, groups.length) }, work))
  return found
}
