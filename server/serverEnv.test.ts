import { expect, test } from 'vitest'
import { removeFile, testHooksOn } from './serverEnv'

test('Should turn the test hooks on only with DOJI_TEST_HOOKS set to 1', () => {
  expect(testHooksOn({ DOJI_TEST_HOOKS: '1' })).toBe(true)
  expect(testHooksOn({ DOJI_TEST_HOOKS: '0' })).toBe(false)
  expect(testHooksOn({ DOJI_TEST_HOOKS: 'true' })).toBe(false)
  expect(testHooksOn({})).toBe(false)
})

test('Should remove a file and take a missing one as already removed', async () => {
  const removed: string[] = []
  await removeFile('a.json', async (file) => {
    removed.push(file)
  })
  expect(removed).toEqual(['a.json'])
  const missing = Object.assign(new Error('gone'), { code: 'ENOENT' })
  await expect(
    removeFile('b.json', async () => {
      throw missing
    }),
  ).resolves.toBeUndefined()
})

test('Should report any other failure to remove a file', async () => {
  const denied = Object.assign(new Error('denied'), { code: 'EACCES' })
  await expect(
    removeFile('c.json', async () => {
      throw denied
    }),
  ).rejects.toBe(denied)
})
