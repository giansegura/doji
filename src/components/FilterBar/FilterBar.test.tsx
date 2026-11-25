import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { SavedFilter } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { FilterBar } from '.'

const filters: SavedFilter[] = [
  { id: 'f1', name: 'Sobrevendidas', scope: 'list', conditions: [{ field: 'rsi', op: 'below', value: 30 }] },
  { id: 'f2', name: 'Fuertes', scope: 'all', conditions: [{ field: 'vsSma200', op: 'above', value: 0 }] },
]

const setup = (active: SavedFilter | null = null) => {
  const handlers = { onApply: vi.fn(), onNew: vi.fn(), onEdit: vi.fn(), onSaveAsList: vi.fn() }
  renderWithTheme(<FilterBar filters={filters} active={active} shown={3} total={8} {...handlers} />)
  return { handlers, user: userEvent.setup() }
}

test('Should apply a saved filter or start a new one from its menu', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  const menu = screen.getByRole('menu', { name: 'Saved filters' })
  expect(within(menu).getByRole('menuitem', { name: 'Fuertes · all watchlists' })).toBeTruthy()
  await user.click(within(menu).getByRole('menuitem', { name: 'Sobrevendidas' }))
  expect(handlers.onApply).toHaveBeenCalledWith('f1')
  await user.click(screen.getByRole('button', { name: 'Filter' }))
  await user.click(screen.getByRole('menuitem', { name: 'New filter…' }))
  expect(handlers.onNew).toHaveBeenCalled()
})

test('Should show the filter applied, how many symbols match, and let it be edited, saved as a list or cleared', async () => {
  const { handlers, user } = setup(filters[0])
  expect(screen.getByText('Sobrevendidas')).toBeTruthy()
  expect(screen.getByText('3 of 8')).toBeTruthy()
  expect(screen.getByTitle('RSI 14 below 30')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Edit filter' }))
  expect(handlers.onEdit).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Save as list' }))
  expect(handlers.onSaveAsList).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Clear filter' }))
  expect(handlers.onApply).toHaveBeenCalledWith(null)
})
