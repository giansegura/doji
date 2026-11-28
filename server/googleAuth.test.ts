import { createHash } from 'node:crypto'
import { expect, test } from 'vitest'
import { type GoogleErrorKind, type GoogleFetch, createGoogleAuth, isGoogleError, pkcePair } from './googleAuth'

const URLS = { auth: 'https://auth.example/auth', token: 'https://auth.example/token', revoke: 'https://auth.example/revoke', api: 'https://api.example' }
const CLIENT = { id: 'client-id', secret: 'client-secret' }
const REDIRECT = 'http://127.0.0.1:4790/oauth/google'
const NOW = Date.parse('2026-11-27T12:00:00.000Z')

const failsWith = (kind: GoogleErrorKind) => (error: unknown) => isGoogleError(error) && error.kind === kind

const reply = (status: number, body: unknown) => ({ status, text: async () => JSON.stringify(body) })

const setup = (answer: GoogleFetch = async () => reply(200, { access_token: 'access-1', expires_in: 3600, refresh_token: 'refresh-1' })) => {
  const calls: { url: string; method: string; headers?: Record<string, string>; form: Record<string, string> }[] = []
  const clock = { at: NOW }
  let drawn = 0
  const auth = createGoogleAuth({
    client: CLIENT,
    urls: URLS,
    redirectUri: REDIRECT,
    fetch: async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, form: Object.fromEntries(new URLSearchParams(init.body)) })
      return answer(url, init)
    },
    now: () => clock.at,
    randomBytes: (size) => Buffer.alloc(size, (drawn += 1)),
  })
  const startedState = () => new URL(auth.start()).searchParams.get('state') as string
  const callback = (state: string, extra: Record<string, string> = { code: 'code-1' }) => auth.finish(new URLSearchParams({ state, ...extra }))
  return { auth, calls, clock, startedState, callback }
}

test('Should make the challenge of the PKCE example in RFC 7636', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  expect(pkcePair(() => Buffer.from(verifier, 'base64url'))).toEqual({
    verifier,
    challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  })
})

test('Should send the person to Google asking for the files doji creates, with PKCE', () => {
  const { auth } = setup()
  const url = new URL(auth.start())
  const verifier = Buffer.alloc(32, 2).toString('base64url')
  expect(`${url.origin}${url.pathname}`).toBe(URLS.auth)
  expect(Object.fromEntries(url.searchParams)).toEqual({
    client_id: 'client-id',
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: Buffer.alloc(16, 1).toString('base64url'),
    access_type: 'offline',
    prompt: 'consent',
  })
  expect(auth.pendingUrl()).toBe(url.toString())
})

test('Should exchange the code for tokens with the verifier it kept', async () => {
  const { startedState, callback, calls, auth } = setup()
  const state = startedState()
  expect(await callback(state)).toEqual({ accessToken: 'access-1', expiresAt: NOW + 3_600_000, refreshToken: 'refresh-1' })
  expect(calls).toEqual([
    {
      url: URLS.token,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      form: {
        code: 'code-1',
        client_id: 'client-id',
        client_secret: 'client-secret',
        code_verifier: Buffer.alloc(32, 2).toString('base64url'),
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT,
      },
    },
  ])
  expect(auth.pendingUrl()).toBeNull()
})

test.each([
  ['another state', { state: 'wrong', code: 'code-1' }],
  ['no state', {}],
  ['a refusal that carries no state', { error: 'access_denied' }],
])('Should refuse a callback with %s and still accept the real one', async (_name, query) => {
  const { startedState, callback, calls, auth } = setup()
  const state = startedState()
  await expect(auth.finish(new URLSearchParams(query))).rejects.toSatisfy(failsWith('invalid_state'))
  expect(auth.pendingUrl()).not.toBeNull()
  expect(calls).toEqual([])
  await callback(state)
  expect(calls).toHaveLength(1)
})

test('Should accept each sign-in only once', async () => {
  const { startedState, callback, calls } = setup()
  const state = startedState()
  await callback(state)
  await expect(callback(state)).rejects.toSatisfy(failsWith('invalid_state'))
  expect(calls).toHaveLength(1)
})

test('Should refuse a callback when no sign-in was started', async () => {
  const { callback, calls } = setup()
  await expect(callback('anything')).rejects.toSatisfy(failsWith('invalid_state'))
  expect(calls).toEqual([])
})

test('Should forget a sign-in after ten minutes', async () => {
  const { startedState, callback, clock, auth, calls } = setup()
  const state = startedState()
  clock.at = NOW + 10 * 60_000 - 1
  expect(auth.pendingUrl()).not.toBeNull()
  clock.at = NOW + 10 * 60_000
  expect(auth.pendingUrl()).toBeNull()
  await expect(callback(state)).rejects.toSatisfy(failsWith('invalid_state'))
  expect(calls).toEqual([])
})

test('Should keep only the newest sign-in', async () => {
  const { startedState, callback } = setup()
  const first = startedState()
  const second = startedState()
  expect(second).not.toBe(first)
  await expect(callback(first)).rejects.toSatisfy(failsWith('invalid_state'))
})

test('Should say when the person did not allow it', async () => {
  const { startedState, callback, calls, auth } = setup()
  await expect(callback(startedState(), { error: 'access_denied' })).rejects.toSatisfy(failsWith('denied'))
  expect(auth.pendingUrl()).toBeNull()
  expect(calls).toEqual([])
})

test('Should fail when Google answers with another error or without a code', async () => {
  const { startedState, callback, calls } = setup()
  await expect(callback(startedState(), { error: 'server_error' })).rejects.toSatisfy(failsWith('unavailable'))
  await expect(callback(startedState(), {})).rejects.toSatisfy(failsWith('unavailable'))
  expect(calls).toEqual([])
})

test('Should say when it cannot reach Google or Google does not give a lasting sign-in', async () => {
  const offline = setup(async () => {
    throw new Error('no network')
  })
  await expect(offline.callback(offline.startedState())).rejects.toSatisfy(failsWith('offline'))
  const refused = setup(async () => reply(400, { error: 'invalid_grant' }))
  await expect(refused.callback(refused.startedState())).rejects.toSatisfy(failsWith('unavailable'))
  const short = setup(async () => reply(200, { access_token: 'access-1', expires_in: 3600 }))
  await expect(short.callback(short.startedState())).rejects.toSatisfy(failsWith('unavailable'))
  const garbage = setup(async () => ({ status: 200, text: async () => '<html>' }))
  await expect(garbage.callback(garbage.startedState())).rejects.toSatisfy(failsWith('unavailable'))
})

test('Should get a new access token with the refresh token', async () => {
  const { auth, calls } = setup(async () => reply(200, { access_token: 'access-2', expires_in: 100 }))
  expect(await auth.refresh('refresh-1')).toEqual({ accessToken: 'access-2', expiresAt: NOW + 100_000 })
  expect(calls[0].url).toBe(URLS.token)
  expect(calls[0].form).toEqual({
    client_id: 'client-id',
    client_secret: 'client-secret',
    grant_type: 'refresh_token',
    refresh_token: 'refresh-1',
  })
})

test('Should say when the sign-in expired, apart from other failures', async () => {
  await expect(setup(async () => reply(400, { error: 'invalid_grant' })).auth.refresh('r')).rejects.toSatisfy(failsWith('expired'))
  await expect(setup(async () => reply(400, { error: 'invalid_client' })).auth.refresh('r')).rejects.toSatisfy(failsWith('unavailable'))
  await expect(setup(async () => reply(500, {})).auth.refresh('r')).rejects.toSatisfy(failsWith('unavailable'))
  const offline = setup(async () => {
    throw new Error('no network')
  })
  await expect(offline.auth.refresh('r')).rejects.toSatisfy(failsWith('offline'))
})

test('Should ask Google to revoke the token and carry on when it cannot', async () => {
  const { auth, calls } = setup()
  await auth.revoke('refresh-1')
  expect(calls).toEqual([
    { url: URLS.revoke, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, form: { token: 'refresh-1' } },
  ])
  const offline = setup(async () => {
    throw new Error('no network')
  })
  await expect(offline.auth.revoke('refresh-1')).resolves.toBeUndefined()
})

test('Should not start anything without a Google client', async () => {
  const auth = createGoogleAuth({
    client: null,
    urls: URLS,
    redirectUri: REDIRECT,
    fetch: async () => reply(200, {}),
    now: () => NOW,
    randomBytes: (size) => Buffer.alloc(size),
  })
  expect(() => auth.start()).toThrow('not_configured')
  await expect(auth.refresh('r')).rejects.toSatisfy(failsWith('not_configured'))
})

test('Should refuse the return of a sign-in that was called off', async () => {
  const { startedState, callback, calls, auth } = setup()
  const state = startedState()
  auth.cancel()
  expect(auth.pendingUrl()).toBeNull()
  await expect(callback(state)).rejects.toSatisfy(failsWith('invalid_state'))
  expect(calls).toEqual([])
})
