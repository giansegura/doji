import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { expect, test, vi } from 'vitest'
import type { ImportProgress } from '../../hooks/useListImport'
import { renderWithTheme } from '../../test/render'
import { themes } from '../../theme/tokens'
import { ListImportDialog } from '.'

const setup = (progress: ImportProgress) => {
  const onClose = vi.fn()
  renderWithTheme(<ListImportDialog progress={progress} onClose={onClose} />)
  return { onClose, user: userEvent.setup() }
}

test('Should say how many symbols it has checked while it works, with nothing to close yet', () => {
  setup({ status: 'checking', name: 'Tech', done: 25, total: 60 })
  expect(screen.getByRole('dialog', { name: 'Import list' })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('Checking the symbols with Yahoo… 25 of 60')
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
})

test('Should report the new list and every symbol that was not found', async () => {
  const { onClose, user } = setup({ status: 'done', name: 'Tech', added: 58, notFound: ['NASDAQ:ZZZZ', 'MARS:XYZ'] })
  expect(screen.getByText('Imported 58 symbols into the new list “Tech”.')).toBeTruthy()
  expect(screen.getByText('Not found (2):')).toBeTruthy()
  expect(screen.getByText('NASDAQ:ZZZZ, MARS:XYZ')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})

test('Should say no list was made when nothing was found', () => {
  setup({ status: 'done', name: 'X', added: 0, notFound: ['ZZZZ'] })
  expect(screen.getByText('None of the symbols in the file were found, so no list was made.')).toBeTruthy()
})

test('Should speak of a single symbol in the singular', () => {
  setup({ status: 'done', name: 'X', added: 1, notFound: [] })
  expect(screen.getByText('Imported 1 symbol into the new list “X”.')).toBeTruthy()
  expect(screen.queryByText(/Not found/)).toBeNull()
})

test('Should say the check failed and close with Escape', async () => {
  const { onClose, user } = setup({ status: 'failed', name: 'X' })
  expect(screen.getByRole('alert').textContent).toBe('Could not check the symbols with Yahoo. Try again in a moment.')
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})

test('Should hold the focus while it checks, keep Tab inside and give the focus back when it closes', async () => {
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const view = renderWithTheme(<ListImportDialog progress={{ status: 'checking', name: 'Tech', done: 1, total: 60 }} onClose={vi.fn()} />)
  const user = userEvent.setup()
  const dialog = screen.getByRole('dialog', { name: 'Import list' })
  expect(document.activeElement).toBe(dialog)
  await user.tab()
  expect(document.activeElement).toBe(dialog)
  view.rerender(
    <ThemeProvider theme={themes.midnight}>
      <ListImportDialog progress={{ status: 'done', name: 'Tech', added: 60, notFound: [] }} onClose={vi.fn()} />
    </ThemeProvider>,
  )
  const close = screen.getByRole('button', { name: 'Close' })
  expect(document.activeElement).toBe(close)
  await user.tab()
  expect(document.activeElement).toBe(close)
  view.unmount()
  expect(document.activeElement).toBe(opener)
  opener.remove()
})
