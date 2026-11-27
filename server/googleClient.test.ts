import { expect, test } from 'vitest'
import { GOOGLE_CALLBACK_PATH, GOOGLE_SCOPE, googleClientFrom, googleUrlsFrom } from './googleClient'

const EMPTY = { id: '', secret: '' }

test('Should have no Google client while the placeholders are empty and nothing is set', () => {
  expect(googleClientFrom({}, EMPTY)).toBeNull()
})

test('Should use the client written in the code', () => {
  expect(googleClientFrom({}, { id: ' code-id ', secret: 'code-secret' })).toEqual({ id: 'code-id', secret: 'code-secret' })
})

test('Should let the environment win over the client written in the code', () => {
  const env = { DOJI_GOOGLE_CLIENT_ID: 'env-id', DOJI_GOOGLE_CLIENT_SECRET: 'env-secret' }
  expect(googleClientFrom(env, { id: 'code-id', secret: 'code-secret' })).toEqual({ id: 'env-id', secret: 'env-secret' })
  expect(googleClientFrom(env, EMPTY)).toEqual({ id: 'env-id', secret: 'env-secret' })
})

test('Should need both the id and the secret', () => {
  expect(googleClientFrom({ DOJI_GOOGLE_CLIENT_ID: 'env-id' }, EMPTY)).toBeNull()
  expect(googleClientFrom({ DOJI_GOOGLE_CLIENT_SECRET: 'env-secret' }, EMPTY)).toBeNull()
  expect(googleClientFrom({ DOJI_GOOGLE_CLIENT_ID: '  ', DOJI_GOOGLE_CLIENT_SECRET: 'env-secret' }, EMPTY)).toBeNull()
})

test('Should ask only for the files doji creates and come back to a path outside the API', () => {
  expect(GOOGLE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file')
  expect(GOOGLE_CALLBACK_PATH).toBe('/oauth/google')
})

test('Should talk to Google', () => {
  expect(googleUrlsFrom({})).toEqual({
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    revoke: 'https://oauth2.googleapis.com/revoke',
    api: 'https://www.googleapis.com',
  })
})

test('Should talk to a fake Google when told where it is', () => {
  expect(googleUrlsFrom({ DOJI_GOOGLE_API: 'http://127.0.0.1:4798/' })).toEqual({
    auth: 'http://127.0.0.1:4798/o/oauth2/v2/auth',
    token: 'http://127.0.0.1:4798/token',
    revoke: 'http://127.0.0.1:4798/revoke',
    api: 'http://127.0.0.1:4798',
  })
})
