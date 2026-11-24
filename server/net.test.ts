import { expect, test } from 'vitest'
import { withTimeout } from './net'

test('Should pass the request on with a signal that limits how long it may take', async () => {
  const seen: { url: string; headers: unknown; signal: unknown }[] = []
  const fetchImpl = async (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => {
    seen.push({ url, headers: init.headers, signal: init.signal })
    return { status: 200 }
  }
  const timed = withTimeout(fetchImpl, 8000)
  expect(await timed('https://example.test/x', { headers: { 'User-Agent': 'Mozilla/5.0' } })).toEqual({ status: 200 })
  expect(seen[0].url).toBe('https://example.test/x')
  expect(seen[0].headers).toEqual({ 'User-Agent': 'Mozilla/5.0' })
  expect(seen[0].signal).toBeInstanceOf(AbortSignal)
})

test('Should give up on a request that never answers', async () => {
  const hanging = (_url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) =>
    new Promise<never>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })
  const started = Date.now()
  await expect(withTimeout(hanging, 30)('https://example.test/x', { headers: {} })).rejects.toThrow('aborted')
  expect(Date.now() - started).toBeLessThan(2000)
})
