import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { BackupApi } from '../../api/client'
import { renderWithTheme } from '../../test/render'
import { BackupPanel } from './BackupPanel'

const fakeApi = (configured = false): BackupApi & { saved: string[] } => {
  const saved: string[] = []
  return {
    saved,
    status: async () => ({ configured, source: 'Twelve Data' }),
    save: vi.fn(async (key: string) => {
      if (key === 'bad') throw Object.assign(new Error('invalid_key'), { code: 'invalid_key' })
      saved.push(key)
      return { configured: true, source: 'Twelve Data' }
    }),
    remove: vi.fn(async () => ({ configured: false, source: 'Twelve Data' })),
  }
}

test('Should save a key for the backup source and say it is set without showing it', async () => {
  const api = fakeApi()
  renderWithTheme(<BackupPanel api={api} />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Twelve Data key'), 'abcdef0123456789')
  await user.click(screen.getByRole('button', { name: 'Save key' }))
  expect(api.saved).toEqual(['abcdef0123456789'])
  expect(await screen.findByText('Twelve Data steps in when Yahoo fails three times in a row.')).toBeTruthy()
  expect(screen.queryByLabelText('Twelve Data key')).toBeNull()
})

test('Should say when the key is not accepted and let a saved one be removed', async () => {
  const api = fakeApi()
  renderWithTheme(<BackupPanel api={api} />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Twelve Data key'), 'bad')
  await user.click(screen.getByRole('button', { name: 'Save key' }))
  expect((await screen.findByRole('alert')).textContent).toBe('That does not look like a Twelve Data key.')
})

test('Should remove a saved key', async () => {
  const api = fakeApi(true)
  renderWithTheme(<BackupPanel api={api} />)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Remove key' }))
  expect(api.remove).toHaveBeenCalled()
  expect(await screen.findByLabelText('Twelve Data key')).toBeTruthy()
})
