import { randomUUID } from 'node:crypto'
import { type GoogleFetch, googleError } from './googleAuth'

export type DriveFile = { id: string; hash: string; changedAt: number }

export type Drive = {
  email: () => Promise<string>
  findFolder: () => Promise<string | null>
  createFolder: () => Promise<string>
  findFile: (folderId: string) => Promise<DriveFile | null>
  fileInfo: (id: string) => Promise<DriveFile | null>
  download: (id: string) => Promise<string>
  create: (folderId: string, text: string, changedAt: number) => Promise<DriveFile>
  update: (id: string, text: string, changedAt: number) => Promise<DriveFile>
}

type DriveDeps = { fetch: GoogleFetch; api: string; token: (fresh?: boolean) => Promise<string> }

type Request = { method: string; headers?: Record<string, string>; body?: string }

type Answer = { status: number; text: string }

type StoredFile = { id?: unknown; md5Checksum?: unknown; modifiedTime?: unknown; trashed?: unknown } | null

const FILE_FIELDS = 'id,md5Checksum,modifiedTime,trashed'
const FOLDER_NAME = 'doji'
const FOLDER_TYPE = 'application/vnd.google-apps.folder'
const FILE_NAME = 'state.json'
const FILE_TYPE = 'application/json'
const MAX_PAGES = 100

export const multipartBody = (metadata: object, text: string, boundary: string): string =>
  [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${FILE_TYPE}`,
    '',
    text,
    `--${boundary}--`,
    '',
  ].join('\r\n')

const jsonOf = <T>(answer: Answer): T => {
  if (answer.status < 200 || answer.status >= 300) throw googleError('unavailable')
  try {
    return JSON.parse(answer.text) as T
  } catch {
    throw googleError('unavailable')
  }
}

const textIn = (value: unknown): string => {
  if (typeof value !== 'string' || value === '') throw googleError('unavailable')
  return value
}

const fileFrom = (stored: StoredFile): DriveFile => {
  const changedAt = Date.parse(textIn(stored?.modifiedTime))
  if (Number.isNaN(changedAt)) throw googleError('unavailable')
  return { id: textIn(stored?.id), hash: textIn(stored?.md5Checksum), changedAt }
}

export const createDrive = (deps: DriveDeps): Drive => {
  const attempt = async (url: string, request: Request, fresh: boolean): Promise<Answer> => {
    const headers = { ...request.headers, Authorization: `Bearer ${await deps.token(fresh)}` }
    try {
      const answer = await deps.fetch(url, { ...request, headers })
      return { status: answer.status, text: await answer.text() }
    } catch {
      throw googleError('offline')
    }
  }

  const call = async (path: string, query: Record<string, string> = {}, request: Request = { method: 'GET' }): Promise<Answer> => {
    const search = new URLSearchParams(query).toString()
    const url = `${deps.api}${path}${search ? `?${search}` : ''}`
    const first = await attempt(url, request, false)
    return first.status === 401 ? attempt(url, request, true) : first
  }

  // Drive may answer with empty pages before the one that holds the match, so none is found only after the last.
  const firstFound = async <T>(q: string, fields: string): Promise<T | undefined> => {
    let pageToken = ''
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = { q, fields: `nextPageToken,files(${fields})`, spaces: 'drive', ...(pageToken ? { pageToken } : {}) }
      const { files, nextPageToken } = jsonOf<{ files?: unknown; nextPageToken?: unknown }>(await call('/drive/v3/files', query))
      if (!Array.isArray(files)) throw googleError('unavailable')
      if (files.length > 0) return files[0] as T
      if (typeof nextPageToken !== 'string' || nextPageToken === '') return undefined
      pageToken = nextPageToken
    }
    throw googleError('unavailable')
  }

  const upload = async (method: string, path: string, metadata: object, text: string): Promise<DriveFile> => {
    const boundary = `doji-${randomUUID()}`
    const answer = await call(
      path,
      { uploadType: 'multipart', fields: FILE_FIELDS },
      { method, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipartBody(metadata, text, boundary) },
    )
    return fileFrom(jsonOf<StoredFile>(answer))
  }

  const filePath = (id: string): string => `/drive/v3/files/${encodeURIComponent(id)}`

  return {
    email: async () => {
      const about = jsonOf<{ user?: { emailAddress?: unknown } }>(await call('/drive/v3/about', { fields: 'user(emailAddress)' }))
      return textIn(about.user?.emailAddress)
    },
    findFolder: async () => {
      const folder = await firstFound<{ id?: unknown }>(
        `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_TYPE}' and 'root' in parents and trashed = false`,
        'id',
      )
      return folder ? textIn(folder.id) : null
    },
    createFolder: async () => {
      const answer = await call(
        '/drive/v3/files',
        {},
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_TYPE }) },
      )
      return textIn(jsonOf<{ id?: unknown }>(answer).id)
    },
    findFile: async (folderId) => {
      const file = await firstFound<StoredFile>(`name = '${FILE_NAME}' and '${folderId}' in parents and trashed = false`, FILE_FIELDS)
      return file ? fileFrom(file) : null
    },
    fileInfo: async (id) => {
      const answer = await call(filePath(id), { fields: FILE_FIELDS })
      if (answer.status === 404) return null
      const stored = jsonOf<StoredFile>(answer)
      return stored?.trashed === true ? null : fileFrom(stored)
    },
    download: async (id) => {
      const answer = await call(filePath(id), { alt: 'media' })
      if (answer.status !== 200) throw googleError('unavailable')
      return answer.text
    },
    create: (folderId, text, changedAt) =>
      upload(
        'POST',
        '/upload/drive/v3/files',
        { name: FILE_NAME, parents: [folderId], mimeType: FILE_TYPE, modifiedTime: new Date(changedAt).toISOString() },
        text,
      ),
    update: (id, text, changedAt) =>
      upload('PATCH', `/upload${filePath(id)}`, { modifiedTime: new Date(changedAt).toISOString() }, text),
  }
}
