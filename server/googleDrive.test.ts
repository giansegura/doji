import { expect, test } from 'vitest'
import { type GoogleErrorKind, googleError, isGoogleError } from './googleAuth'
import { createDrive, multipartBody } from './googleDrive'

const API = 'https://api.example'
const FIELDS = 'id,md5Checksum,modifiedTime,trashed'
const STORED = { id: 'file-1', md5Checksum: 'abc123', modifiedTime: '2026-11-27T12:00:00.000Z', trashed: false }
const FILE = { id: 'file-1', hash: 'abc123', changedAt: Date.parse('2026-11-27T12:00:00.000Z') }

const failsWith = (kind: GoogleErrorKind) => (error: unknown) => isGoogleError(error) && error.kind === kind

type Answer = { status?: number; body?: unknown; text?: string }

const setup = (...answers: Answer[]) => {
  const calls: { url: URL; method: string; headers: Record<string, string>; body?: string }[] = []
  const tokens: boolean[] = []
  const queue = [...answers]
  const drive = createDrive({
    fetch: async (url, init) => {
      calls.push({ url: new URL(url), method: init.method, headers: init.headers ?? {}, body: init.body })
      const answer = queue.shift() ?? { status: 500 }
      return { status: answer.status ?? 200, text: async () => answer.text ?? JSON.stringify(answer.body ?? {}) }
    },
    api: API,
    token: async (fresh = false) => {
      tokens.push(fresh)
      return fresh ? 'new-token' : 'token'
    },
  })
  const asked = (index = 0) => ({
    method: calls[index].method,
    path: `${calls[index].url.origin}${calls[index].url.pathname}`,
    query: Object.fromEntries(calls[index].url.searchParams),
  })
  return { drive, calls, tokens, asked }
}

test('Should ask whose account it is', async () => {
  const { drive, asked, calls } = setup({ body: { user: { emailAddress: 'ana@example.com' } } })
  expect(await drive.email()).toBe('ana@example.com')
  expect(asked()).toEqual({ method: 'GET', path: `${API}/drive/v3/about`, query: { fields: 'user(emailAddress)' } })
  expect(calls[0].headers.Authorization).toBe('Bearer token')
})

test('Should look for the doji folder at the top of My Drive', async () => {
  const { drive, asked } = setup({ body: { files: [{ id: 'folder-1' }] } }, { body: { files: [] } })
  expect(await drive.findFolder()).toBe('folder-1')
  expect(asked()).toEqual({
    method: 'GET',
    path: `${API}/drive/v3/files`,
    query: {
      q: "name = 'doji' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false",
      fields: 'files(id)',
      spaces: 'drive',
    },
  })
  expect(await drive.findFolder()).toBeNull()
})

test('Should create the doji folder', async () => {
  const { drive, asked, calls } = setup({ body: { id: 'folder-1' } })
  expect(await drive.createFolder()).toBe('folder-1')
  expect(asked()).toEqual({ method: 'POST', path: `${API}/drive/v3/files`, query: {} })
  expect(calls[0].headers['Content-Type']).toBe('application/json')
  expect(JSON.parse(calls[0].body ?? '')).toEqual({ name: 'doji', mimeType: 'application/vnd.google-apps.folder' })
})

test('Should look for state.json inside the doji folder', async () => {
  const { drive, asked } = setup({ body: { files: [STORED] } }, { body: { files: [] } })
  expect(await drive.findFile('folder-1')).toEqual(FILE)
  expect(asked()).toEqual({
    method: 'GET',
    path: `${API}/drive/v3/files`,
    query: { q: "name = 'state.json' and 'folder-1' in parents and trashed = false", fields: `files(${FIELDS})`, spaces: 'drive' },
  })
  expect(await drive.findFile('folder-1')).toBeNull()
})

test('Should read what Drive knows about a file, and nothing once it is gone or in the bin', async () => {
  const { drive, asked } = setup({ body: STORED }, { body: { ...STORED, trashed: true } }, { status: 404 })
  expect(await drive.fileInfo('file-1')).toEqual(FILE)
  expect(asked()).toEqual({ method: 'GET', path: `${API}/drive/v3/files/file-1`, query: { fields: FIELDS } })
  expect(await drive.fileInfo('file-1')).toBeNull()
  expect(await drive.fileInfo('file-1')).toBeNull()
})

test('Should download the text of a file as it is', async () => {
  const { drive, asked } = setup({ text: '{"version": 1}' })
  expect(await drive.download('file-1')).toBe('{"version": 1}')
  expect(asked()).toEqual({ method: 'GET', path: `${API}/drive/v3/files/file-1`, query: { alt: 'media' } })
})

test('Should build an upload with the file details and then its text', () => {
  expect(multipartBody({ name: 'state.json' }, '{"a": "ñ"}', 'edge')).toBe(
    [
      '--edge',
      'Content-Type: application/json; charset=UTF-8',
      '',
      '{"name":"state.json"}',
      '--edge',
      'Content-Type: application/json',
      '',
      '{"a": "ñ"}',
      '--edge--',
      '',
    ].join('\r\n'),
  )
})

const boundaryOf = (headers: Record<string, string>): string => {
  const [, boundary] = /^multipart\/related; boundary=(\S+)$/.exec(headers['Content-Type']) ?? []
  return boundary
}

test('Should create state.json in the folder with the time of the change', async () => {
  const { drive, asked, calls } = setup({ body: STORED })
  expect(await drive.create('folder-1', '{"version": 1}', FILE.changedAt)).toEqual(FILE)
  expect(asked()).toEqual({ method: 'POST', path: `${API}/upload/drive/v3/files`, query: { uploadType: 'multipart', fields: FIELDS } })
  const metadata = { name: 'state.json', parents: ['folder-1'], mimeType: 'application/json', modifiedTime: STORED.modifiedTime }
  const boundary = boundaryOf(calls[0].headers)
  expect(boundary).toBeTruthy()
  expect(calls[0].body).toBe(multipartBody(metadata, '{"version": 1}', boundary))
})

test('Should write a new version of the file with the time of the change', async () => {
  const { drive, asked, calls } = setup({ body: STORED })
  expect(await drive.update('file-1', '{"version": 1}', FILE.changedAt + 0.75)).toEqual(FILE)
  expect(asked()).toEqual({ method: 'PATCH', path: `${API}/upload/drive/v3/files/file-1`, query: { uploadType: 'multipart', fields: FIELDS } })
  expect(calls[0].body).toBe(multipartBody({ modifiedTime: STORED.modifiedTime }, '{"version": 1}', boundaryOf(calls[0].headers)))
})

test('Should get a fresh token and try once more when Google refuses one', async () => {
  const { drive, calls, tokens } = setup({ status: 401 }, { body: { files: [] } })
  expect(await drive.findFolder()).toBeNull()
  expect(tokens).toEqual([false, true])
  expect(calls.map((call) => call.headers.Authorization)).toEqual(['Bearer token', 'Bearer new-token'])
})

test('Should give up after the second refusal', async () => {
  const { drive, calls } = setup({ status: 401 }, { status: 401 }, { body: { files: [] } })
  await expect(drive.findFolder()).rejects.toSatisfy(failsWith('unavailable'))
  expect(calls).toHaveLength(2)
})

test('Should tell a lost connection from an answer of Google', async () => {
  const offline = createDrive({
    fetch: async () => {
      throw new Error('no network')
    },
    api: API,
    token: async () => 'token',
  })
  await expect(offline.findFolder()).rejects.toSatisfy(failsWith('offline'))
  await expect(setup({ status: 500 }).drive.findFolder()).rejects.toSatisfy(failsWith('unavailable'))
  await expect(setup({ status: 403 }).drive.fileInfo('file-1')).rejects.toSatisfy(failsWith('unavailable'))
  await expect(setup({ status: 404 }).drive.download('file-1')).rejects.toSatisfy(failsWith('unavailable'))
})

test('Should not trust an answer that lacks what it asked for', async () => {
  await expect(setup({ text: '<html>' }).drive.findFolder()).rejects.toSatisfy(failsWith('unavailable'))
  await expect(setup({ body: {} }).drive.findFolder()).rejects.toSatisfy(failsWith('unavailable'))
  await expect(setup({ body: {} }).drive.email()).rejects.toSatisfy(failsWith('unavailable'))
  await expect(setup({ body: {} }).drive.createFolder()).rejects.toSatisfy(failsWith('unavailable'))
  await expect(setup({ body: { id: 'file-1' } }).drive.fileInfo('file-1')).rejects.toSatisfy(failsWith('unavailable'))
})

test('Should pass on why there is no token', async () => {
  const drive = createDrive({
    fetch: async () => ({ status: 200, text: async () => '{}' }),
    api: API,
    token: async () => {
      throw googleError('expired')
    },
  })
  await expect(drive.findFolder()).rejects.toSatisfy(failsWith('expired'))
})
