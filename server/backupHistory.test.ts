import { expect, test } from 'vitest'
import type { History } from '../shared/types'
import { createBackupHistory } from './backupHistory'
import { providerError } from './provider/yahoo'

const historyOf = (over: Partial<History> = {}): History => ({
  info: { symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ' },
  bars: [{ time: '2026-11-24', open: 1, high: 2, low: 1, close: 2, volume: 1 }],
  splits: [],
  fetchedAt: 'x',
  stale: false,
  ...over,
})

const setup = (backupFails = false) => {
  const asked: string[] = []
  let clock = Date.parse('2026-11-25T12:00:00Z')
  const backup = {
    name: 'Twelve Data',
    history: async (symbol: string) => {
      asked.push(symbol)
      if (backupFails) throw providerError('unavailable', 'down')
      return historyOf({ source: 'Twelve Data' })
    },
  }
  const served = createBackupHistory({ backup, now: () => new Date(clock) })
  return { served, asked, advance: (ms: number) => (clock += ms) }
}

const stale = async () => historyOf({ stale: true })
const down = async (): Promise<History> => {
  throw providerError('unavailable', 'down')
}

test('Should serve Yahoo while it answers', async () => {
  const { served, asked } = setup()
  expect((await served.serve('AAPL', async () => historyOf())).source).toBeUndefined()
  expect(asked).toEqual([])
})

test('Should turn to the backup after three failures of Yahoo in a row', async () => {
  const { served, asked } = setup()
  expect((await served.serve('AAPL', stale)).stale).toBe(true)
  await expect(served.serve('MSFT', down)).rejects.toMatchObject({ kind: 'unavailable' })
  const third = await served.serve('AAPL', stale)
  expect(third.source).toBe('Twelve Data')
  expect(asked).toEqual(['AAPL'])
})

test('Should go back to Yahoo once it answers again', async () => {
  const { served, asked } = setup()
  await served.serve('AAPL', stale)
  await served.serve('AAPL', stale)
  await served.serve('AAPL', stale)
  expect((await served.serve('AAPL', async () => historyOf())).source).toBeUndefined()
  expect((await served.serve('AAPL', stale)).stale).toBe(true)
  expect(asked).toEqual(['AAPL'])
})

test('Should keep what the backup gave for fifteen minutes', async () => {
  const { served, asked, advance } = setup()
  for (let attempt = 0; attempt < 4; attempt += 1) await served.serve('AAPL', stale)
  advance(10 * 60_000)
  await served.serve('AAPL', stale)
  expect(asked).toEqual(['AAPL'])
  advance(6 * 60_000)
  await served.serve('AAPL', stale)
  expect(asked).toEqual(['AAPL', 'AAPL'])
})

test('Should not count an unknown symbol as a failure and keep what Yahoo had when the backup fails too', async () => {
  const { served } = setup(true)
  const unknown = async (): Promise<History> => {
    throw providerError('not_found', 'no such symbol')
  }
  for (let attempt = 0; attempt < 3; attempt += 1) await expect(served.serve('ZZZZ', unknown)).rejects.toMatchObject({ kind: 'not_found' })
  for (let attempt = 0; attempt < 3; attempt += 1) await served.serve('AAPL', stale)
  expect((await served.serve('AAPL', stale)).stale).toBe(true)
  await expect(served.serve('MSFT', down)).rejects.toMatchObject({ kind: 'unavailable' })
})
