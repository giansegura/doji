import { expect, test } from 'vitest'
import type { SymbolInfo } from '../shared/types'
import { resolveSymbols } from './resolveSymbols'
import { providerError } from './provider/yahoo'

const known: Record<string, SymbolInfo> = {
  AAPL: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  'MC.PA': { symbol: 'MC.PA', name: 'LVMH', exchange: 'Paris' },
}

const lookup = (asked: string[]) => async (symbol: string): Promise<SymbolInfo> => {
  asked.push(symbol)
  const info = known[symbol]
  if (!info) throw providerError('not_found', 'unknown')
  return info
}

test('Should give each group the first candidate Yahoo knows, or nothing', async () => {
  const asked: string[] = []
  const found = await resolveSymbols([['AAPL'], ['MC.AS', 'MC.PA', 'MC.BR'], ['ZZZZ'], []], lookup(asked))
  expect(found).toEqual([known.AAPL, known['MC.PA'], null, null])
  expect(asked).not.toContain('MC.BR')
})

test('Should stop when Yahoo fails for a reason other than an unknown symbol', async () => {
  const failing = async () => {
    throw providerError('unavailable', 'down')
  }
  await expect(resolveSymbols([['AAPL']], failing)).rejects.toMatchObject({ kind: 'unavailable' })
})

test('Should ask for a few symbols at a time', async () => {
  let running = 0
  let most = 0
  const slow = async (symbol: string): Promise<SymbolInfo> => {
    running += 1
    most = Math.max(most, running)
    await new Promise((resolve) => setTimeout(resolve, 5))
    running -= 1
    return { symbol, name: symbol, exchange: 'NYSE' }
  }
  const groups = Array.from({ length: 12 }, (_, index) => [`S${index}`])
  const found = await resolveSymbols(groups, slow, 3)
  expect(found.map((info) => info?.symbol)).toEqual(groups.map(([symbol]) => symbol))
  expect(most).toBe(3)
})
