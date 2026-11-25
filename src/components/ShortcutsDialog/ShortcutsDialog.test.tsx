import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { ShortcutsDialog } from '.'

const setup = () => {
  const onClose = vi.fn()
  renderWithTheme(<ShortcutsDialog onClose={onClose} />)
  return { onClose, user: userEvent.setup() }
}

test('Should list every shortcut with its keys', () => {
  setup()
  const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
  const rows = within(dialog).getAllByRole('row').map((row) => row.textContent)
  expect(rows).toEqual(
    expect.arrayContaining([
      'Alt+TTrend line',
      'Alt+HHorizontal line',
      'Alt+CChannel',
      'Alt+RRectangle',
      'Alt+MMeasure',
      'EscBack to the cursor, close a menu',
      'Delete / BackspaceDelete the selected drawing',
      'Cmd+Z / Ctrl+ZUndo a change to the drawings',
      'Cmd+Shift+Z / Ctrl+YRedo',
      '↑ / ↓Previous or next symbol of the watchlist',
      'Alt+WHide or show the watchlist',
      '→Next bar while replaying',
      '?This list',
      'A–Z / 0–9Search a symbol, starting with that character',
      'EnterOpen the first result of the search',
    ]),
  )
})

test('Should close with the button or with Escape', async () => {
  const { onClose, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(2)
})

test('Should keep Tab inside the dialog and give the focus back to what opened it', async () => {
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const view = renderWithTheme(<ShortcutsDialog onClose={vi.fn()} />)
  const user = userEvent.setup()
  const close = screen.getByRole('button', { name: 'Close' })
  expect(document.activeElement).toBe(close)
  await user.tab()
  expect(document.activeElement).toBe(close)
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(close)
  view.unmount()
  expect(document.activeElement).toBe(opener)
  opener.remove()
})
