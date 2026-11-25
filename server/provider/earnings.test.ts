import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { type EarningsFetch, NO_EARNINGS, createEarningsSource, parseEarnings } from './earnings'

const aapl: unknown = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'earnings-aapl.json'), 'utf8'))
const NOW = new Date('2026-11-24T12:00:00Z')

const TIMING = { '2026-01-29': 'post', '2026-04-30': 'post', '2026-07-30': 'post', '2026-11-02': 'post', '2027-01-28': 'post' }

test('Should read the last reported dates and the next one from a Yahoo answer', () => {
  expect(parseEarnings(aapl, NOW)).toMatchObject({
    past: ['2026-01-29', '2026-04-30', '2026-07-30', '2026-11-02'],
    next: '2027-01-28',
    nextIsEstimate: false,
    timing: TIMING,
  })
})

const answerAt = (stamps: number[]) => ({
  quoteSummary: {
    result: [
      {
        calendarEvents: { earnings: { earningsDate: [], isEarningsDateEstimate: false } },
        earnings: { earningsChart: { quarterly: stamps.map((raw) => ({ reportedDate: { raw } })) } },
      },
    ],
  },
})

test('Should tell a report before the opening from one after the close, and say nothing when only the day is known', () => {
  const before = Date.parse('2026-07-29T11:30:00Z') / 1000
  const after = Date.parse('2026-10-28T20:05:00Z') / 1000
  const during = Date.parse('2026-04-29T15:00:00Z') / 1000
  const dayOnly = Date.parse('2026-01-28T00:00:00Z') / 1000
  expect(parseEarnings(answerAt([before, after, during, dayOnly]), NOW).timing).toEqual({ '2026-07-29': 'pre', '2026-10-28': 'post' })
})

test('Should read the actual and the expected earnings per share of each report and the expected one of the next', () => {
  const quarter = (date: string, actual: number | null, estimate: number | null) => ({
    reportedDate: { raw: Date.parse(`${date}T21:00:00Z`) / 1000, fmt: date },
    actual: actual === null ? {} : { raw: actual },
    estimate: estimate === null ? {} : { raw: estimate },
  })
  const answer = {
    quoteSummary: {
      result: [
        {
          calendarEvents: { earnings: { earningsDate: [{ raw: 1801170000, fmt: '2027-01-28' }], earningsAverage: { raw: 2.91 } } },
          earnings: { earningsChart: { quarterly: [quarter('2026-07-30', 2.02, 1.89), quarter('2026-10-29', 1.5, 1.6), quarter('2026-11-02', null, 2)] } },
        },
      ],
    },
  }
  const earnings = parseEarnings(answer, NOW)
  expect(earnings.results).toEqual({
    '2026-07-30': { actual: 2.02, estimate: 1.89 },
    '2026-10-29': { actual: 1.5, estimate: 1.6 },
  })
  expect(earnings.nextEstimate).toBe(2.91)
})

test('Should drop a next date that has already gone by and read an answer without earnings as none', () => {
  expect(parseEarnings(aapl, new Date('2027-02-10T00:00:00Z')).next).toBeNull()
  expect(parseEarnings({ quoteSummary: { result: null, error: { code: 'Not Found' } } }, NOW)).toEqual(NO_EARNINGS)
  expect(parseEarnings('nonsense', NOW)).toEqual(NO_EARNINGS)
})

type Answer = { status: number; body?: string; cookies?: string[] }

const fakeYahoo = (answers: (url: string, init: { headers: Record<string, string> }) => Answer) => {
  const calls: { url: string; cookie?: string }[] = []
  const fetch: EarningsFetch = async (url, init) => {
    calls.push({ url, cookie: init.headers.Cookie })
    const answer = answers(url, init)
    return {
      status: answer.status,
      headers: { getSetCookie: () => answer.cookies ?? [] },
      text: async () => answer.body ?? '',
    }
  }
  return { fetch, calls }
}

const yahoo = (crumbs: string[], summary: (call: number) => Answer = () => ({ status: 200, body: JSON.stringify(aapl) })) => {
  let crumbCalls = 0
  let summaryCalls = 0
  return fakeYahoo((url) => {
    if (url.startsWith('https://fc.yahoo.com')) return { status: 404, cookies: ['A3=abc; Max-Age=31557600; HttpOnly', 'other=1'] }
    if (url.includes('/getcrumb')) {
      crumbCalls += 1
      return { status: 200, body: crumbs[crumbCalls - 1] ?? 'last' }
    }
    summaryCalls += 1
    return summary(summaryCalls)
  })
}

test('Should get a cookie and a crumb once and ask Yahoo for the earnings with both', async () => {
  const { fetch, calls } = yahoo(['c1'])
  let clock = NOW.getTime()
  const source = createEarningsSource({ fetch, now: () => new Date(clock) })
  expect((await source.get('AAPL')).next).toBe('2027-01-28')
  clock += 60_000
  await source.get('MSFT')
  const summaries = calls.filter((call) => call.url.includes('quoteSummary'))
  expect(summaries.map((call) => call.url)).toEqual([
    expect.stringContaining('/quoteSummary/AAPL?modules=calendarEvents%2Cearnings&crumb=c1'),
    expect.stringContaining('/quoteSummary/MSFT?modules=calendarEvents%2Cearnings&crumb=c1'),
  ])
  expect(summaries.every((call) => call.cookie === 'A3=abc')).toBe(true)
  expect(calls.filter((call) => call.url.includes('/getcrumb'))).toHaveLength(1)
})

test('Should get a new crumb once when Yahoo refuses the old one', async () => {
  const { fetch, calls } = yahoo(['old', 'new'], (call) => (call === 1 ? { status: 401 } : { status: 200, body: JSON.stringify(aapl) }))
  const source = createEarningsSource({ fetch, now: () => NOW })
  expect((await source.get('AAPL')).past).toHaveLength(4)
  expect(calls.filter((call) => call.url.includes('quoteSummary')).at(-1)?.url).toContain('crumb=new')
})

test('Should keep the earnings of a symbol for twelve hours', async () => {
  const { fetch, calls } = yahoo(['c1'])
  let clock = NOW.getTime()
  const source = createEarningsSource({ fetch, now: () => new Date(clock) })
  await source.get('AAPL')
  clock += 11 * 3_600_000
  await source.get('aapl')
  expect(calls.filter((call) => call.url.includes('quoteSummary'))).toHaveLength(1)
  clock += 2 * 3_600_000
  await source.get('AAPL')
  expect(calls.filter((call) => call.url.includes('quoteSummary'))).toHaveLength(2)
})

test('Should answer with no earnings, and with what it had before, when Yahoo fails', async () => {
  let failing = false
  let clock = NOW.getTime()
  const { fetch } = yahoo(['c1'], () => (failing ? { status: 500 } : { status: 200, body: JSON.stringify(aapl) }))
  const source = createEarningsSource({ fetch, now: () => new Date(clock) })
  expect(await createEarningsSource({ fetch: async () => Promise.reject(new Error('offline')), now: () => NOW }).get('AAPL')).toEqual(
    NO_EARNINGS,
  )
  await source.get('AAPL')
  failing = true
  clock += 13 * 3_600_000
  expect((await source.get('AAPL')).next).toBe('2027-01-28')
})

test('Should not hand out as next a date that went by while it was kept, and count it as reported with its timing', async () => {
  let clock = Date.parse('2027-01-28T20:00:00Z')
  const { fetch } = yahoo(['c1'])
  const source = createEarningsSource({ fetch, now: () => new Date(clock) })
  expect((await source.get('AAPL')).next).toBe('2027-01-28')
  clock += 9 * 3_600_000
  const moved = {
    past: ['2026-01-29', '2026-04-30', '2026-07-30', '2026-11-02', '2027-01-28'],
    next: null,
    nextIsEstimate: false,
    timing: TIMING,
  }
  expect(await source.get('AAPL')).toMatchObject(moved)
  expect(source.peek('AAPL')).toMatchObject(moved)
})

test('Should ask Yahoo once when the same symbol is asked for twice at the same time', async () => {
  let summaries = 0
  const { fetch } = yahoo(['c1'], () => {
    summaries += 1
    return summaries === 1 ? { status: 200, body: JSON.stringify(aapl) } : { status: 500 }
  })
  const source = createEarningsSource({ fetch, now: () => NOW })
  const [first, second] = await Promise.all([source.get('AAPL'), source.get('aapl')])
  expect(summaries).toBe(1)
  expect(second).toEqual(first)
  expect((await source.get('AAPL')).next).toBe('2027-01-28')
})

const memoryStore = (initial: unknown = null) => {
  const box = { data: initial, saves: 0 }
  return { box, store: { load: async () => box.data, save: async (data: unknown) => {
    box.data = data
    box.saves += 1
  } } }
}

test('Should start from the earnings kept on disk and keep there what it asks for', async () => {
  const kept = { AAPL: { at: NOW.getTime() - 3_600_000, earnings: { past: ['2026-11-02'], next: '2027-01-28', nextIsEstimate: false } } }
  const { box, store } = memoryStore(kept)
  const { fetch, calls } = yahoo(['c1'])
  const source = createEarningsSource({ fetch, now: () => NOW, store })
  expect((await source.get('AAPL')).past).toEqual(['2026-11-02'])
  expect(calls).toHaveLength(0)
  await source.get('MSFT')
  expect(Object.keys(box.data as object).sort()).toEqual(['AAPL', 'MSFT'])
})

test('Should give what it already has and fetch the rest in the background, a few at a time', async () => {
  const { fetch, calls } = yahoo(['c1'])
  const source = createEarningsSource({ fetch, now: () => NOW })
  await source.get('AAPL')
  expect(source.peek('AAPL')?.next).toBe('2027-01-28')
  expect(source.peek('MSFT')).toBeNull()
  const done = source.warm(['AAPL', 'MSFT', 'KO', 'PEP'])
  expect(source.pending()).toBe(3)
  await done
  expect(source.pending()).toBe(0)
  expect(source.peek('PEP')?.past).toHaveLength(4)
  expect(calls.filter((call) => call.url.includes('quoteSummary'))).toHaveLength(4)
})
