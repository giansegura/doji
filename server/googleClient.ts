// OWNER: paste here the "Desktop app" OAuth client of doji's Google Cloud project (docs/guia.md, "Crear el cliente de Google").
// Google documents that an installed app's client secret is not treated as a secret.
export const GOOGLE_CLIENT_ID = '' // PLACEHOLDER
export const GOOGLE_CLIENT_SECRET = '' // PLACEHOLDER

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const GOOGLE_CALLBACK_PATH = '/oauth/google'

export type GoogleClient = { id: string; secret: string }

export type GoogleUrls = { auth: string; token: string; revoke: string; api: string }

type Env = Record<string, string | undefined>

const AUTH_PATH = '/o/oauth2/v2/auth'

const GOOGLE_URLS: GoogleUrls = {
  auth: `https://accounts.google.com${AUTH_PATH}`,
  token: 'https://oauth2.googleapis.com/token',
  revoke: 'https://oauth2.googleapis.com/revoke',
  api: 'https://www.googleapis.com',
}

export const googleClientFrom = (
  env: Env,
  written: GoogleClient = { id: GOOGLE_CLIENT_ID, secret: GOOGLE_CLIENT_SECRET },
): GoogleClient | null => {
  const id = (env.DOJI_GOOGLE_CLIENT_ID || written.id).trim()
  const secret = (env.DOJI_GOOGLE_CLIENT_SECRET || written.secret).trim()
  return id && secret ? { id, secret } : null
}

export const googleUrlsFrom = (env: Env): GoogleUrls => {
  const fake = env.DOJI_GOOGLE_API?.replace(/\/+$/, '')
  if (!fake) return GOOGLE_URLS
  return { auth: `${fake}${AUTH_PATH}`, token: `${fake}/token`, revoke: `${fake}/revoke`, api: fake }
}
