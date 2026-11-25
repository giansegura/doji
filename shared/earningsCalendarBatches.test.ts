import { expect, test } from 'vitest'
import { MAX_CALENDAR_SYMBOLS, askInBatches } from './earningsCalendarBatches'

const earningsOf = (symbol: string) => ({ past: [], next: `2026-12-0${symbol.length % 9}`, nextIsEstimate: false })

test('Should ask for a long list of symbols in batches the server takes and join the answers', async () => {
  const symbols = Array.from({ length: MAX_CALENDAR_SYMBOLS + 20 }, (_, index) => `S${index}`)
  const asked: string[][] = []
  const answer = await askInBatches(symbols, async (batch) => {
    asked.push(batch)
    return { earnings: Object.fromEntries(batch.map((symbol) => [symbol, earningsOf(symbol)])), pending: asked.length === 1 ? 3 : 7 }
  })
  expect(asked.map((batch) => batch.length)).toEqual([MAX_CALENDAR_SYMBOLS, 20])
  expect(Object.keys(answer.earnings)).toHaveLength(MAX_CALENDAR_SYMBOLS + 20)
  expect(answer.pending).toBe(7)
})

test('Should ask once for a short list and nothing for an empty one', async () => {
  const asked: string[][] = []
  const ask = async (batch: string[]) => {
    asked.push(batch)
    return { earnings: {}, pending: 0 }
  }
  await askInBatches(['KO', 'PEP'], ask)
  expect(asked).toEqual([['KO', 'PEP']])
  expect(await askInBatches([], ask)).toEqual({ earnings: {}, pending: 0 })
  expect(asked).toHaveLength(1)
})
