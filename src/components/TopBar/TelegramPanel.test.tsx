import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { TelegramApi, TelegramStatus } from '../../api/client'
import { renderWithTheme } from '../../test/render'
import { TelegramPanel } from './TelegramPanel'

const OFF: TelegramStatus = { connected: false, bot: null, linked: false }
const CONNECTED: TelegramStatus = { connected: true, bot: 'doji_alerts_bot', linked: false }
const LINKED: TelegramStatus = { ...CONNECTED, linked: true }

const failure = (code: string) => Object.assign(new Error(code), { code })

const fakeApi = (start: TelegramStatus, over: Partial<TelegramApi> = {}): TelegramApi => ({
  status: vi.fn(async () => start),
  connect: vi.fn(async () => CONNECTED),
  link: vi.fn(async () => LINKED),
  test: vi.fn(async () => ({ ok: true })),
  disconnect: vi.fn(async () => OFF),
  ...over,
})

test('Should connect a bot from the token pasted', async () => {
  const api = fakeApi(OFF)
  renderWithTheme(<TelegramPanel api={api} />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Bot token'), '123:abc')
  await user.click(screen.getByRole('button', { name: 'Connect' }))
  expect(api.connect).toHaveBeenCalledWith('123:abc')
  expect(await screen.findByText(/@doji_alerts_bot connected/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Link chat' })).toBeTruthy()
})

test('Should say when Telegram does not take the token', async () => {
  const api = fakeApi(OFF, { connect: vi.fn(async () => Promise.reject(failure('invalid_token'))) })
  renderWithTheme(<TelegramPanel api={api} />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Bot token'), 'nope')
  await user.click(screen.getByRole('button', { name: 'Connect' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Telegram did not accept that token.')
})

test('Should link the chat once the user wrote to the bot, and say when nobody has yet', async () => {
  const link = vi.fn().mockRejectedValueOnce(failure('no_message')).mockResolvedValueOnce(LINKED)
  const api = fakeApi(CONNECTED, { link })
  renderWithTheme(<TelegramPanel api={api} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Link chat' }))
  expect((await screen.findByRole('alert')).textContent).toBe('The bot has not received any message yet. Send it one and try again.')
  await user.click(screen.getByRole('button', { name: 'Link chat' }))
  expect(await screen.findByText('Alerts go to @doji_alerts_bot.')).toBeTruthy()
})

test('Should send a test message and disconnect the bot', async () => {
  const api = fakeApi(LINKED)
  renderWithTheme(<TelegramPanel api={api} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Send test message' }))
  expect((await screen.findByRole('status')).textContent).toBe('Test message sent.')
  await user.click(screen.getByRole('button', { name: 'Disconnect' }))
  await waitFor(() => expect(screen.getByLabelText('Bot token')).toBeTruthy())
  expect(api.disconnect).toHaveBeenCalled()
})
