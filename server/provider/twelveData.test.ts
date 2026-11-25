import { expect, test } from 'vitest'
import { createTwelveData, parseTwelveSeries, twelveSymbol } from './twelveData'

test('Should name each symbol the way Twelve Data does, and leave out the markets it does not cover here', () => {
  expect(twelveSymbol('AAPL')).toBe('AAPL')
  expect(twelveSymbol('BRK-B')).toBe('BRK.B')
  expect(twelveSymbol('BTC-USD')).toBe('BTC/USD')
  expect(twelveSymbol('EURUSD=X')).toBe('EUR/USD')
  expect(twelveSymbol('EUR=X')).toBe('USD/EUR')
  expect(twelveSymbol('SAN.MC')).toBeNull()
  expect(twelveSymbol('^GSPC')).toBeNull()
  expect(twelveSymbol('ES=F')).toBeNull()
})

const answer = {
  meta: { symbol: 'AAPL', currency: 'USD', exchange: 'NASDAQ', exchange_timezone: 'America/New_York' },
  values: [
    { datetime: '2026-11-24', open: '348.12', high: '354.37', low: '345.88', close: '354.07', volume: '40235897' },
    { datetime: '2026-11-21', open: '340', high: '351', low: '339', close: '349.08', volume: '1000' },
  ],
  status: 'ok',
}

test('Should read the daily bars oldest first with the currency of the symbol', () => {
  const history = parseTwelveSeries(answer, 'AAPL', '2026-11-25T01:00:00.000Z')
  expect(history.bars).toEqual([
    { time: '2026-11-21', open: 340, high: 351, low: 339, close: 349.08, volume: 1000 },
    { time: '2026-11-24', open: 348.12, high: 354.37, low: 345.88, close: 354.07, volume: 40235897 },
  ])
  expect(history).toMatchObject({ info: { symbol: 'AAPL', name: 'AAPL', exchange: 'NASDAQ' }, currency: 'USD', splits: [], stale: false, source: 'Twelve Data' })
})

test('Should ask with the key for the whole daily history and fail clearly without a key or for a symbol it does not cover', async () => {
  const asked: string[] = []
  const twelve = createTwelveData({
    fetch: async (url) => {
      asked.push(url)
      return { status: 200, text: async () => JSON.stringify(answer) }
    },
    apiUrl: 'https://api.twelvedata.com',
    key: async () => 'k123',
  })
  expect((await twelve.history('AAPL')).bars).toHaveLength(2)
  expect(asked).toEqual(['https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=5000&order=asc&apikey=k123'])
  await expect(twelve.history('SAN.MC')).rejects.toMatchObject({ kind: 'not_found' })
  const keyless = createTwelveData({ fetch: async () => ({ status: 200, text: async () => '{}' }), apiUrl: 'x', key: async () => null })
  await expect(keyless.history('AAPL')).rejects.toMatchObject({ kind: 'unavailable' })
})

test('Should fail clearly when Twelve Data answers with an error', async () => {
  const twelve = createTwelveData({
    fetch: async () => ({ status: 200, text: async () => JSON.stringify({ status: 'error', code: 429, message: 'limit' }) }),
    apiUrl: 'x',
    key: async () => 'k',
  })
  await expect(twelve.history('AAPL')).rejects.toMatchObject({ kind: 'unavailable' })
})

test('Should fail as unavailable when Twelve Data answers with a broken body', async () => {
  const twelve = createTwelveData({ fetch: async () => ({ status: 200, text: async () => '{"status": "ok", "val' }), apiUrl: 'x', key: async () => 'k' })
  await expect(twelve.history('AAPL')).rejects.toMatchObject({ kind: 'unavailable' })
})
