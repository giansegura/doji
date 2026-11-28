import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { GoogleApi, GoogleStatus } from '../../api/client'
import { renderWithTheme } from '../../test/render'
import { GooglePanel } from './GooglePanel'

const SIGNED_OUT: GoogleStatus = {
  configured: true,
  email: null,
  sync: 'signedOut',
  signInUrl: null,
  lastSyncAt: null,
  choice: null,
  replacedRev: null,
}
const SIGNED_IN: GoogleStatus = { ...SIGNED_OUT, email: 'ana@example.com', sync: 'idle', lastSyncAt: '2026-11-27T14:05:00' }
const WAITING: GoogleStatus = { ...SIGNED_OUT, sync: 'waiting', signInUrl: 'https://accounts.example/sign-in' }
const CHOOSE: GoogleStatus = {
  ...SIGNED_OUT,
  email: 'ana@example.com',
  sync: 'choose',
  choice: {
    id: 'copy-1',
    local: { lists: 3, symbols: 41, drawings: 12, changedAt: '2026-11-27T14:05:00' },
    drive: { lists: 1, symbols: 1, drawings: 1, changedAt: null },
  },
}

const fakeApi = (initial: GoogleStatus, over: Partial<GoogleApi> = {}) => {
  const box = { status: initial }
  const becomes = (next: GoogleStatus) => async () => (box.status = next)
  const api = {
    status: vi.fn(async () => box.status),
    signIn: vi.fn(async () => {
      box.status = WAITING
      return { url: 'https://accounts.example/sign-in' }
    }),
    syncNow: vi.fn(becomes(SIGNED_IN)),
    choose: vi.fn(becomes(SIGNED_IN)),
    signOut: vi.fn(becomes(SIGNED_OUT)),
    ...over,
  }
  return { api, box }
}

const mount = (status: GoogleStatus, over: Partial<GoogleApi> = {}) => {
  const openPage = vi.fn()
  const setup = fakeApi(status, over)
  const view = renderWithTheme(<GooglePanel api={setup.api} openPage={openPage} />)
  return { ...setup, ...view, openPage }
}

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('Should show nothing when sign-in is not configured', async () => {
  const { api, container } = mount({ ...SIGNED_OUT, configured: false })
  await act(async () => undefined)
  expect(api.status).toHaveBeenCalled()
  expect(container.textContent).toBe('')
})

test('Should show nothing when the server cannot say how Google Drive stands', async () => {
  const status = vi.fn(async (): Promise<GoogleStatus> => {
    throw Object.assign(new Error('not_found'), { code: 'not_found' })
  })
  const { container } = mount(SIGNED_OUT, { status })
  await act(async () => undefined)
  expect(status).toHaveBeenCalled()
  expect(container.textContent).toBe('')
})

test('Should offer to sign in, open the Google page and leave a link to it', async () => {
  const { api, openPage } = mount(SIGNED_OUT)
  expect(await screen.findByText('Keep your settings in your own Google Drive and use them on any computer. doji only sees the files it creates.')).toBeTruthy()
  expect(screen.getByText('Google Drive')).toBeTruthy()
  await userEvent.setup().click(button('Sign in with Google'))
  expect(api.signIn).toHaveBeenCalled()
  expect(openPage).toHaveBeenCalledWith('https://accounts.example/sign-in')
  expect(await screen.findByText('Finish signing in on the Google page.')).toBeTruthy()
  const link = screen.getByRole('link', { name: 'Open the Google page' })
  expect(link.getAttribute('href')).toBe('https://accounts.example/sign-in')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
})

test('Should open the Google page in a new tab that cannot reach back', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  const { api } = fakeApi(SIGNED_OUT)
  renderWithTheme(<GooglePanel api={api} />)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign in with Google' }))
  expect(open).toHaveBeenCalledWith('https://accounts.example/sign-in', '_blank', 'noopener,noreferrer')
})

test('Should look every two seconds until the sign-in and its first sync are over', async () => {
  vi.useFakeTimers()
  const { api, box } = mount(WAITING)
  const wait = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms))
  await wait(0)
  expect(api.status).toHaveBeenCalledTimes(1)
  await wait(2_000)
  expect(api.status).toHaveBeenCalledTimes(2)
  box.status = { ...SIGNED_IN, sync: 'syncing' }
  await wait(2_000)
  expect(screen.getByText('Syncing…')).toBeTruthy()
  box.status = SIGNED_IN
  await wait(2_000)
  expect(screen.getByText('Signed in as ana@example.com.')).toBeTruthy()
  await wait(10_000)
  expect(api.status).toHaveBeenCalledTimes(4)
})

test('Should keep looking after a check fails, and stop when the menu closes', async () => {
  vi.useFakeTimers()
  const { api, box, unmount } = mount(WAITING)
  const wait = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms))
  await wait(0)
  vi.mocked(api.status).mockRejectedValueOnce(new Error('sin servidor'))
  await wait(2_000)
  expect(screen.getByText('Finish signing in on the Google page.')).toBeTruthy()
  box.status = { ...WAITING, signInUrl: null }
  await wait(2_000)
  expect(screen.queryByRole('link', { name: 'Open the Google page' })).toBeNull()
  unmount()
  await wait(10_000)
  expect(api.status).toHaveBeenCalledTimes(3)
})

test('Should show the account, the last sync, and sync or sign out', async () => {
  const { api } = mount(SIGNED_IN)
  expect(await screen.findByText('Signed in as ana@example.com.')).toBeTruthy()
  expect(screen.getByText(/^Last synced Nov 27, 2026, 2:05\sPM$/)).toBeTruthy()
  const user = userEvent.setup()
  await user.click(button('Sync now'))
  expect(api.syncNow).toHaveBeenCalled()
  await user.click(button('Sign out'))
  expect(api.signOut).toHaveBeenCalled()
  expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy()
})

test.each([
  [{ ...SIGNED_IN, lastSyncAt: null }, 'Not synced yet'],
  [{ ...SIGNED_IN, sync: 'offline' as const }, 'Offline. Your changes stay on this computer and doji will try again.'],
  [{ ...SIGNED_IN, sync: 'failed' as const }, 'Google Drive is not answering. doji will try again.'],
])('Should say how the sync stands (%#)', async (status, text) => {
  mount(status)
  expect(await screen.findByText(text)).toBeTruthy()
  expect(button('Sync now').getAttribute('aria-disabled')).toBe('false')
  expect(screen.queryByRole('alert')).toBeNull()
})

test('Should not offer to sync while it is syncing', async () => {
  const { api } = mount({ ...SIGNED_IN, sync: 'syncing' })
  expect(await screen.findByText('Syncing…')).toBeTruthy()
  expect(button('Sync now').getAttribute('aria-disabled')).toBe('true')
  expect(button('Sign out').disabled).toBe(false)
  await userEvent.setup().click(button('Sync now'))
  expect(api.syncNow).not.toHaveBeenCalled()
})

test('Should ask which copy to keep, describing both', async () => {
  mount(CHOOSE)
  expect(
    await screen.findByText("Google Drive already has doji settings that are different from this computer's. Which do you want to keep?"),
  ).toBeTruthy()
  expect(screen.getByText(/^This computer: 3 lists, 41 symbols, 12 drawings · Nov 27, 2026, 2:05\sPM$/)).toBeTruthy()
  expect(screen.getByText('Google Drive: 1 list, 1 symbol, 1 drawing')).toBeTruthy()
  expect(screen.getByText('The other copy is kept as a backup.')).toBeTruthy()
})

test('Should say whose account is asking and let the person leave without choosing', async () => {
  const { api } = mount(CHOOSE)
  expect(await screen.findByText('Signed in as ana@example.com.')).toBeTruthy()
  await userEvent.setup().click(button('Sign out'))
  expect(api.signOut).toHaveBeenCalled()
  expect(api.choose).not.toHaveBeenCalled()
  expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy()
})

test.each([
  ["Keep this computer's", 'local'],
  ["Use Google Drive's", 'drive'],
] as const)('Should keep the copy chosen with %s', async (name, keep) => {
  const { api } = mount(CHOOSE)
  await userEvent.setup().click(await screen.findByRole('button', { name }))
  expect(api.choose).toHaveBeenCalledWith(keep, 'copy-1')
  expect(await screen.findByRole('button', { name: 'Sync now' })).toBeTruthy()
  expect(screen.queryByRole('button', { name })).toBeNull()
})

test('Should say when the sign-in expired and offer to sign in again or out', async () => {
  const { api, openPage } = mount({ ...SIGNED_IN, sync: 'expired' })
  expect(await screen.findByText('Your Google sign-in expired. Sign in again to keep syncing.')).toBeTruthy()
  expect(button('Sign out')).toBeTruthy()
  await userEvent.setup().click(button('Sign in with Google'))
  expect(api.signIn).toHaveBeenCalled()
  expect(openPage).toHaveBeenCalled()
})

test('Should say when it could not reach Google Drive', async () => {
  const { openPage } = mount(SIGNED_OUT, {
    signIn: vi.fn(async (): Promise<{ url: string }> => {
      throw Object.assign(new Error('network'), { code: 'network' })
    }),
  })
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign in with Google' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Could not reach Google Drive. Try again.')
  expect(openPage).not.toHaveBeenCalled()
  expect(button('Sign in with Google').disabled).toBe(false)
})

test.each([
  ['expired', { ...SIGNED_IN, sync: 'expired' as const }],
  ['choosing', CHOOSE],
])('Should let the buttons move to another line rather than break their text when %s', async (_name, status) => {
  mount(status)
  const row = (await screen.findByRole('button', { name: 'Sign out' })).parentElement as HTMLElement
  expect(getComputedStyle(row).flexWrap).toBe('wrap')
})

test('Should say it is syncing from the moment sync is asked for until Google answers', async () => {
  let answer: (status: GoogleStatus) => void = () => undefined
  const syncNow = vi.fn(() => new Promise<GoogleStatus>((done) => (answer = done)))
  mount({ ...SIGNED_IN, sync: 'offline' }, { syncNow })
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Sync now' }))
  expect(screen.getByRole('status').textContent).toBe('Syncing…')
  expect(button('Sync now').getAttribute('aria-disabled')).toBe('true')
  expect(button('Sign out').disabled).toBe(true)
  await user.click(button('Sync now'))
  expect(syncNow).toHaveBeenCalledTimes(1)
  await act(async () => answer({ ...SIGNED_IN, sync: 'failed' }))
  expect(screen.getByRole('status').textContent).toBe('Google Drive is not answering. doji will try again.')
  expect(button('Sync now').getAttribute('aria-disabled')).toBe('false')
})

test('Should keep the keyboard on Sync now while it syncs', async () => {
  mount(SIGNED_IN, { syncNow: vi.fn(() => new Promise<GoogleStatus>(() => undefined)) })
  const sync = await screen.findByRole('button', { name: 'Sync now' })
  const user = userEvent.setup()
  sync.focus()
  await user.keyboard('{Enter}')
  expect(button('Sync now').disabled).toBe(false)
  expect(document.activeElement).toBe(sync)
})

test('Should stop saying it is syncing when the request fails', async () => {
  const syncNow = vi.fn(async (): Promise<GoogleStatus> => {
    throw Object.assign(new Error('network'), { code: 'network' })
  })
  mount(SIGNED_IN, { syncNow })
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Sync now' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toMatch(/^Last synced /)
})

test('Should keep the keyboard on Start again while it asks for a new page', async () => {
  const signIn = vi.fn(() => new Promise<{ url: string }>(() => undefined))
  mount(WAITING, { signIn })
  const again = await screen.findByRole('button', { name: 'Start again' })
  const user = userEvent.setup()
  again.focus()
  await user.keyboard('{Enter}')
  expect(button('Start again').disabled).toBe(false)
  expect(again.getAttribute('aria-disabled')).toBe('true')
  expect(document.activeElement).toBe(again)
  await user.keyboard('{Enter}')
  expect(signIn).toHaveBeenCalledTimes(1)
})

test('Should offer to start signing in again while waiting for the person', async () => {
  const { api, openPage } = mount({ ...WAITING, signInUrl: 'https://accounts.example/old' })
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Start again' }))
  expect(api.signIn).toHaveBeenCalledTimes(1)
  expect(openPage).toHaveBeenCalledWith('https://accounts.example/sign-in')
})

test('Should show the new question when Drive changed since the one that was answered', async () => {
  const newer: GoogleStatus = {
    ...CHOOSE,
    choice: { id: 'copy-2', local: CHOOSE.choice!.local, drive: { lists: 4, symbols: 9, drawings: 2, changedAt: null } },
  }
  const choose = vi.fn(async () => newer)
  mount(CHOOSE, { choose })
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: "Use Google Drive's" }))
  expect(await screen.findByText('Google Drive: 4 lists, 9 symbols, 2 drawings')).toBeTruthy()
  await user.click(button("Use Google Drive's"))
  expect(choose.mock.calls).toEqual([
    ['drive', 'copy-1'],
    ['drive', 'copy-2'],
  ])
})
