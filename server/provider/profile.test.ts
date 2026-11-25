import { expect, test } from 'vitest'
import { createProfileSource, parseProfile } from './profile'
import type { YahooSummary } from './yahooSummary'

const NOW = new Date('2026-11-25T12:00:00Z')

const raw = (value: number) => ({ raw: value, fmt: String(value) })

const apple = {
  quoteSummary: {
    result: [
      {
        price: { quoteType: 'EQUITY', currency: 'USD', longName: 'Apple Inc.', marketCap: raw(5_145_409_617_920) },
        summaryDetail: {
          marketCap: raw(5_145_409_617_920),
          trailingPE: raw(39.43),
          forwardPE: raw(33.49),
          dividendYield: raw(0.0031),
          beta: raw(1.089),
          fiftyTwoWeekHigh: raw(360.83),
          fiftyTwoWeekLow: raw(243.42),
        },
        assetProfile: {
          sector: 'Technology',
          industry: 'Consumer Electronics',
          country: 'United States',
          fullTimeEmployees: 167000,
          website: 'https://www.apple.com',
          longBusinessSummary: 'Apple Inc. designs smartphones.',
        },
        defaultKeyStatistics: {},
      },
    ],
    error: null,
  },
}

const spy = {
  quoteSummary: {
    result: [
      {
        price: { quoteType: 'ETF', currency: 'USD', longName: 'SPDR S&P 500 ETF Trust' },
        summaryDetail: { trailingPE: raw(22.87), yield: raw(0.01), totalAssets: raw(796_865_200_128), fiftyTwoWeekHigh: raw(781.62), fiftyTwoWeekLow: raw(629.28) },
        assetProfile: { longBusinessSummary: 'The trust holds the S&P 500.' },
        defaultKeyStatistics: { category: 'Large Blend' },
      },
    ],
  },
}

test('Should read the sheet of a company', () => {
  expect(parseProfile(apple)).toEqual({
    kind: 'EQUITY',
    name: 'Apple Inc.',
    currency: 'USD',
    marketCap: 5_145_409_617_920,
    totalAssets: null,
    trailingPE: 39.43,
    forwardPE: 33.49,
    dividendYield: 0.0031,
    beta: 1.089,
    high52: 360.83,
    low52: 243.42,
    sector: 'Technology',
    industry: 'Consumer Electronics',
    category: null,
    country: 'United States',
    employees: 167000,
    website: 'https://www.apple.com',
    summary: 'Apple Inc. designs smartphones.',
  })
})

test('Should read the sheet of a fund with its assets, its yield and its category', () => {
  expect(parseProfile(spy)).toMatchObject({ kind: 'ETF', totalAssets: 796_865_200_128, dividendYield: 0.01, category: 'Large Blend', marketCap: null, sector: null })
})

test('Should read nothing from an answer without a result', () => {
  expect(parseProfile({ quoteSummary: { result: [] } })).toBeNull()
  expect(parseProfile(null)).toBeNull()
})

const fakeSummary = (answers: (unknown | Error)[]) => {
  const asked: string[] = []
  const summary: YahooSummary = {
    ask: async (symbol, modules) => {
      asked.push(`${symbol} ${modules}`)
      const answer = answers[Math.min(asked.length - 1, answers.length - 1)]
      if (answer instanceof Error) throw answer
      return answer
    },
  }
  return { summary, asked }
}

test('Should ask Yahoo once a day for the sheet of each symbol', async () => {
  const { summary, asked } = fakeSummary([apple])
  let clock = NOW.getTime()
  const source = createProfileSource({ summary, now: () => new Date(clock) })
  expect((await source.get('aapl'))?.name).toBe('Apple Inc.')
  clock += 23 * 3_600_000
  await source.get('AAPL')
  expect(asked).toEqual(['AAPL price,summaryDetail,assetProfile,defaultKeyStatistics'])
  clock += 2 * 3_600_000
  await source.get('AAPL')
  expect(asked).toHaveLength(2)
})

test('Should say there is no sheet for a symbol Yahoo does not know', async () => {
  const { summary } = fakeSummary([null])
  expect(await createProfileSource({ summary, now: () => NOW }).get('ZZZZ')).toBeNull()
})

test('Should keep the sheet it had when Yahoo fails, and try again ten minutes later', async () => {
  const { summary, asked } = fakeSummary([apple, new Error('status_500'), new Error('status_500'), apple])
  let clock = NOW.getTime()
  const source = createProfileSource({ summary, now: () => new Date(clock) })
  await source.get('AAPL')
  clock += 25 * 3_600_000
  expect((await source.get('AAPL'))?.name).toBe('Apple Inc.')
  clock += 5 * 60_000
  await source.get('AAPL')
  expect(asked).toHaveLength(2)
  clock += 6 * 60_000
  await source.get('AAPL')
  expect(asked).toHaveLength(3)
})

test('Should start from the sheets kept on disk and keep there what it asks for', async () => {
  const saved: unknown[] = []
  const store = { load: async () => ({ KO: { at: NOW.getTime() - 3_600_000, profile: parseProfile(apple) } }), save: async (data: unknown) => void saved.push(data) }
  const { summary, asked } = fakeSummary([spy])
  const source = createProfileSource({ summary, now: () => NOW, store })
  expect((await source.get('KO'))?.name).toBe('Apple Inc.')
  await source.get('SPY')
  expect(asked).toEqual(['SPY price,summaryDetail,assetProfile,defaultKeyStatistics'])
  expect(Object.keys(saved.at(-1) as object)).toEqual(['KO', 'SPY'])
})

test('Should ask Yahoo once when the same sheet is asked for twice at the same time', async () => {
  const { summary, asked } = fakeSummary([apple, new Error('down')])
  const source = createProfileSource({ summary, now: () => NOW })
  const [first, second] = await Promise.all([source.get('AAPL'), source.get('aapl')])
  expect(asked).toHaveLength(1)
  expect(first?.name).toBe('Apple Inc.')
  expect(second?.name).toBe('Apple Inc.')
  expect((await source.get('AAPL'))?.name).toBe('Apple Inc.')
})
