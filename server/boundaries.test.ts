import { readFile, readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { expect, test } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..')

const sourcesIn = async (folder: string): Promise<string[]> => {
  const entries = await readdir(join(ROOT, folder), { withFileTypes: true, recursive: true })
  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

const importersOf = async (folder: string, target: RegExp): Promise<string[]> => {
  const files = await sourcesIn(folder)
  const texts = await Promise.all(files.map((file) => readFile(file, 'utf8')))
  return files.filter((_, index) => target.test(texts[index])).map((file) => relative(ROOT, file))
}

test('Should keep the server free of imports from the app code', async () => {
  expect(await importersOf('server', /from '(\.\.\/)+src\//)).toEqual([])
})

test('Should keep the shared code free of imports from the app and the server', async () => {
  expect(await importersOf('shared', /from '(\.\.\/)+(src|server)\//)).toEqual([])
})
