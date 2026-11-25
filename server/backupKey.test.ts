import { expect, test } from 'vitest'
import { createBackupKey } from './backupKey'

const memory = () => {
  const box: { data: unknown } = { data: null }
  return {
    box,
    store: {
      load: async () => box.data,
      save: async (data: unknown) => {
        box.data = data
      },
      clear: async () => {
        box.data = null
      },
    },
  }
}

test('Should keep a key, say only that there is one and forget it', async () => {
  const { box, store } = memory()
  const keys = createBackupKey({ store })
  expect(await keys.status()).toEqual({ configured: false, source: 'Twelve Data' })
  expect(await keys.set('abcdef0123456789abcdef0123456789')).toEqual({ configured: true, source: 'Twelve Data' })
  expect(box.data).toEqual({ key: 'abcdef0123456789abcdef0123456789' })
  expect(await keys.get()).toBe('abcdef0123456789abcdef0123456789')
  expect(await keys.clear()).toEqual({ configured: false, source: 'Twelve Data' })
  expect(await keys.get()).toBeNull()
})

test('Should refuse a key that does not look like one', async () => {
  const { store } = memory()
  await expect(createBackupKey({ store }).set('no vale')).rejects.toMatchObject({ name: 'BackupKeyError' })
})
