import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { SavedFilter } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { FilterEditor } from '.'

const fresh: SavedFilter = { id: 'f1', name: '', scope: 'list', conditions: [{ field: 'rsi', op: 'below', value: 30 }] }

const setup = (filter: SavedFilter = fresh, editing = false) => {
  const handlers = { onSave: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() }
  renderWithTheme(<FilterEditor filter={filter} editing={editing} {...handlers} />)
  return { handlers, user: userEvent.setup(), dialog: screen.getByRole('dialog', { name: editing ? 'Edit filter' : 'New filter' }) }
}

test('Should save a new filter with its name and its first condition', async () => {
  const { handlers, user, dialog } = setup()
  const save = within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement
  expect(save.disabled).toBe(true)
  await user.type(within(dialog).getByRole('textbox', { name: 'Filter name' }), 'Sobrevendidas')
  await user.click(save)
  expect(handlers.onSave).toHaveBeenCalledWith({ ...fresh, name: 'Sobrevendidas' })
})

test('Should add and change conditions and apply the filter to every watchlist', async () => {
  const { handlers, user, dialog } = setup({ ...fresh, name: 'Fuertes' })
  await user.click(within(dialog).getByRole('button', { name: 'Add condition' }))
  const rows = within(dialog).getAllByRole('group', { name: /^Condition / })
  expect(rows).toHaveLength(2)
  await user.selectOptions(within(rows[1]).getByRole('combobox', { name: 'Field' }), 'vsSma200')
  await user.selectOptions(within(rows[1]).getByRole('combobox', { name: 'Comparison' }), 'above')
  const value = within(rows[1]).getByRole('spinbutton', { name: 'Value' })
  await user.clear(value)
  await user.type(value, '0')
  await user.click(within(dialog).getByRole('radio', { name: 'All watchlists' }))
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  expect(handlers.onSave).toHaveBeenCalledWith({
    id: 'f1',
    name: 'Fuertes',
    scope: 'all',
    conditions: [
      { field: 'rsi', op: 'below', value: 30 },
      { field: 'vsSma200', op: 'above', value: 0 },
    ],
  })
})

test('Should not save without a condition or with a value that is not a number', async () => {
  const { user, dialog } = setup({ ...fresh, name: 'X' })
  const value = within(dialog).getByRole('spinbutton', { name: 'Value' })
  await user.clear(value)
  expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(within(dialog).getByRole('button', { name: 'Remove condition 1' }))
  expect(within(dialog).queryAllByRole('group', { name: /^Condition / })).toHaveLength(0)
  expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
})

test('Should delete a saved filter and close with Escape', async () => {
  const { handlers, user, dialog } = setup({ ...fresh, name: 'Vieja' }, true)
  await user.click(within(dialog).getByRole('button', { name: 'Delete filter' }))
  expect(handlers.onDelete).toHaveBeenCalledWith('f1')
  await user.keyboard('{Escape}')
  expect(handlers.onClose).toHaveBeenCalled()
})

test('Should keep Tab inside the editor and give the focus back when it closes', async () => {
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const handlers = { onSave: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() }
  const view = renderWithTheme(<FilterEditor filter={{ ...fresh, name: 'Sobrevendidas' }} editing={false} {...handlers} />)
  const user = userEvent.setup()
  const name = screen.getByRole('textbox', { name: 'Filter name' })
  const save = screen.getByRole('button', { name: 'Save' })
  expect(document.activeElement).toBe(name)
  save.focus()
  await user.tab()
  expect(document.activeElement).toBe(name)
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(save)
  view.unmount()
  expect(document.activeElement).toBe(opener)
  opener.remove()
})

test('Should let the page scroll when the editor is taller than the window', () => {
  const { dialog } = setup()
  expect(getComputedStyle(dialog.parentElement as HTMLElement).overflowY).toBe('auto')
})
