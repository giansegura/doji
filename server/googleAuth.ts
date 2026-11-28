import { createHash } from 'node:crypto'
import { GOOGLE_SCOPE, type GoogleClient, type GoogleUrls } from './googleClient'

export type GoogleFetch = (
  url: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; text: () => Promise<string> }>

export type GoogleErrorKind = 'not_configured' | 'invalid_state' | 'denied' | 'expired' | 'offline' | 'unavailable'

export type AccessToken = { accessToken: string; expiresAt: number }

export type GoogleTokens = AccessToken & { refreshToken: string }

export type GoogleAuth = {
  start: () => string
  pendingUrl: () => string | null
  cancel: () => void
  finish: (query: URLSearchParams) => Promise<GoogleTokens>
  refresh: (refreshToken: string) => Promise<AccessToken>
  revoke: (token: string) => Promise<void>
}

type AuthDeps = {
  client: GoogleClient | null
  urls: GoogleUrls
  redirectUri: string
  fetch: GoogleFetch
  now: () => number
  randomBytes: (size: number) => Buffer
}

type PendingSignIn = { state: string; verifier: string; url: string; createdAt: number }

type TokenAnswer = { error?: unknown; access_token?: unknown; expires_in?: unknown; refresh_token?: unknown } | null

const SIGN_IN_TTL_MS = 10 * 60_000
const ERROR_NAME = 'GoogleError'

export const googleError = (kind: GoogleErrorKind): Error & { kind: GoogleErrorKind } =>
  Object.assign(new Error(kind), { kind, name: ERROR_NAME })

export const isGoogleError = (error: unknown): error is Error & { kind: GoogleErrorKind } =>
  error instanceof Error && error.name === ERROR_NAME

export const pkcePair = (randomBytes: (size: number) => Buffer): { verifier: string; challenge: string } => {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

const parsed = (text: string): TokenAnswer => {
  try {
    return JSON.parse(text) as TokenAnswer
  } catch {
    return null
  }
}

export const createGoogleAuth = (deps: AuthDeps): GoogleAuth => {
  let pending: PendingSignIn | null = null

  const configured = (): GoogleClient => {
    if (!deps.client) throw googleError('not_configured')
    return deps.client
  }

  const current = (): PendingSignIn | null => (pending && deps.now() - pending.createdAt < SIGN_IN_TTL_MS ? pending : null)

  const post = async (url: string, form: Record<string, string>): Promise<{ status: number; body: TokenAnswer }> => {
    try {
      const answer = await deps.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form).toString(),
      })
      return { status: answer.status, body: parsed(await answer.text()) }
    } catch {
      throw googleError('offline')
    }
  }

  const accessFrom = (answer: { status: number; body: TokenAnswer }): AccessToken => {
    const { access_token: accessToken, expires_in: seconds } = answer.body ?? {}
    if (answer.status !== 200 || typeof accessToken !== 'string') throw googleError('unavailable')
    return { accessToken, expiresAt: deps.now() + (typeof seconds === 'number' ? seconds * 1000 : 0) }
  }

  const start = (): string => {
    const client = configured()
    const state = deps.randomBytes(16).toString('base64url')
    const { verifier, challenge } = pkcePair(deps.randomBytes)
    const query = new URLSearchParams({
      client_id: client.id,
      redirect_uri: deps.redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      prompt: 'consent',
    })
    pending = { state, verifier, url: `${deps.urls.auth}?${query}`, createdAt: deps.now() }
    return pending.url
  }

  const finish = async (query: URLSearchParams): Promise<GoogleTokens> => {
    const flow = current()
    // Only a return that carries the state of this sign-in ends it: any web page can open the callback address.
    if (!flow || query.get('state') !== flow.state) throw googleError('invalid_state')
    pending = null
    if (query.get('error') === 'access_denied') throw googleError('denied')
    const code = query.get('code')
    if (query.has('error') || !code) throw googleError('unavailable')
    const client = configured()
    const answer = await post(deps.urls.token, {
      code,
      client_id: client.id,
      client_secret: client.secret,
      code_verifier: flow.verifier,
      grant_type: 'authorization_code',
      redirect_uri: deps.redirectUri,
    })
    const refreshToken = answer.body?.refresh_token
    if (typeof refreshToken !== 'string') throw googleError('unavailable')
    return { ...accessFrom(answer), refreshToken }
  }

  const refresh = async (refreshToken: string): Promise<AccessToken> => {
    const client = configured()
    const answer = await post(deps.urls.token, {
      client_id: client.id,
      client_secret: client.secret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    if (answer.status === 400 && answer.body?.error === 'invalid_grant') throw googleError('expired')
    return accessFrom(answer)
  }

  const revoke = async (token: string): Promise<void> => {
    await post(deps.urls.revoke, { token }).catch(() => undefined)
  }

  const cancel = (): void => {
    pending = null
  }

  return { start, pendingUrl: () => current()?.url ?? null, cancel, finish, refresh, revoke }
}
