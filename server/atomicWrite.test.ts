import { chmod, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { writeAtomic } from './atomicWrite'

const makeFile = async () => join(await mkdtemp(join(tmpdir(), 'doji-write-')), 'secret.json')

test('Should write a file that only its owner can read when asked to', async () => {
  const file = await makeFile()
  await writeAtomic(file, 'secret', 0o600)
  expect((await stat(file)).mode & 0o777).toBe(0o600)
  expect(await readFile(file, 'utf8')).toBe('secret')
})

test('Should narrow the permissions of a file it writes again', async () => {
  const file = await makeFile()
  await writeFile(file, 'old', { mode: 0o644 })
  await writeAtomic(file, 'new', 0o600)
  expect((await stat(file)).mode & 0o777).toBe(0o600)
  expect(await readdir(join(file, '..'))).toEqual(['secret.json'])
})

test('Should write a secret only into a temporary file it made itself', async () => {
  const file = await makeFile()
  await writeFile(`${file}.tmp`, 'left behind')
  await chmod(`${file}.tmp`, 0o644)
  await writeAtomic(file, 'secret', 0o600)
  expect((await stat(file)).mode & 0o777).toBe(0o600)
  expect(await readFile(file, 'utf8')).toBe('secret')
})
