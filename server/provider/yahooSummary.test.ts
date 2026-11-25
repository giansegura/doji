import { expect, test } from 'vitest'
import { createYahooSummary } from './yahooSummary'

const CRUMB_OK = 'abcdefghijk'

test('Should open only one new session when two requests are refused with the same old one', async () => {
  let cookies = 0
  const fetch = async (url: string, init?: { headers?: Record<string, string> }) => {
    const reply = (status: number, body = '', setCookie: string[] = []) => ({
      status,
      headers: { getSetCookie: () => setCookie },
      text: async () => body,
    })
    if (url.includes('fc.yahoo.com')) {
      cookies += 1
      return reply(404, '', [`A3=session${cookies}; Path=/`])
    }
    if (url.includes('getcrumb')) return reply(200, CRUMB_OK)
    const cookie = init?.headers?.Cookie ?? ''
    return cookie === 'A3=session1' ? reply(401) : reply(200, '{"quoteSummary":{"result":[]}}')
  }
  const summary = createYahooSummary({ fetch: fetch as never })
  await Promise.all([summary.ask('KO', 'price'), summary.ask('PEP', 'price')])
  expect(cookies).toBe(2)
})
