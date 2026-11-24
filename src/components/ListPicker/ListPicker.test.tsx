import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { SymbolList } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { ListPicker } from '.'

const lists: SymbolList[] = [
  { id: 'a', name: 'Tecnología', items: [] },
  { id: 'b', name: 'Bancos', items: [] },
]

const setup = (over: { lists?: SymbolList[]; activeId?: string } = {}) => {
  const handlers = { onSelect: vi.fn(), onCreate: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn() }
  renderWithTheme(<ListPicker lists={over.lists ?? lists} activeId={over.activeId ?? 'a'} {...handlers} />)
  return { handlers, user: userEvent.setup() }
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Listas de seguimiento' }))

test('Should show the name of the active list and keep the menu closed', () => {
  setup({ activeId: 'b' })
  const trigger = screen.getByRole('button', { name: 'Listas de seguimiento' })
  expect(trigger.textContent).toContain('Bancos')
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('menu')).toBeNull()
})

test('Should list every list and mark the active one', async () => {
  const { user } = setup()
  await openMenu(user)
  expect(screen.getByRole('menuitem', { name: 'Tecnología' }).getAttribute('aria-current')).toBe('true')
  expect(screen.getByRole('menuitem', { name: 'Bancos' }).getAttribute('aria-current')).toBe(null)
})

test('Should switch to another list and close the menu', async () => {
  const { handlers, user } = setup()
  await openMenu(user)
  await user.click(screen.getByRole('menuitem', { name: 'Bancos' }))
  expect(handlers.onSelect).toHaveBeenCalledWith('b')
  expect(screen.queryByRole('menu')).toBeNull()
})

test('Should create a list with the typed name', async () => {
  const { handlers, user } = setup()
  await openMenu(user)
  await user.click(screen.getByRole('button', { name: 'Crear lista nueva' }))
  const input = screen.getByRole('textbox', { name: 'Nombre de la lista nueva' })
  expect(document.activeElement).toBe(input)
  await user.type(input, 'Energía{Enter}')
  expect(handlers.onCreate).toHaveBeenCalledWith('Energía')
  expect(screen.queryByRole('menu')).toBeNull()
})

test('Should not create a list without a name', async () => {
  const { handlers, user } = setup()
  await openMenu(user)
  await user.click(screen.getByRole('button', { name: 'Crear lista nueva' }))
  await user.type(screen.getByRole('textbox', { name: 'Nombre de la lista nueva' }), '   {Enter}')
  expect(handlers.onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole('menu')).toBeTruthy()
})

test('Should rename a list starting from its current name', async () => {
  const { handlers, user } = setup()
  await openMenu(user)
  await user.click(screen.getByRole('button', { name: 'Renombrar Bancos' }))
  const input = screen.getByRole('textbox', { name: 'Nuevo nombre de Bancos' }) as HTMLInputElement
  expect(input.value).toBe('Bancos')
  await user.clear(input)
  await user.type(input, 'Banca europea{Enter}')
  expect(handlers.onRename).toHaveBeenCalledWith('b', 'Banca europea')
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('Should cancel a rename with Escape and keep the menu open', async () => {
  const { handlers, user } = setup()
  await openMenu(user)
  await user.click(screen.getByRole('button', { name: 'Renombrar Bancos' }))
  await user.type(screen.getByRole('textbox', { name: 'Nuevo nombre de Bancos' }), 'x{Escape}')
  expect(handlers.onRename).not.toHaveBeenCalled()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('menuitem', { name: 'Bancos' })).toBeTruthy()
})

test('Should duplicate a list and close the menu', async () => {
  const { handlers, user } = setup()
  await openMenu(user)
  await user.click(screen.getByRole('button', { name: 'Duplicar Bancos' }))
  expect(handlers.onDuplicate).toHaveBeenCalledWith('b')
  expect(screen.queryByRole('menu')).toBeNull()
})

test('Should not offer to duplicate once there are twenty lists', async () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ id: `l${index}`, name: `Lista ${index}`, items: [] }))
  const { handlers, user } = setup({ lists: many, activeId: 'l0' })
  await openMenu(user)
  const duplicate = screen.getByRole('button', { name: 'Duplicar Lista 3' })
  expect(duplicate.hasAttribute('disabled')).toBe(true)
  await user.click(duplicate)
  expect(handlers.onDuplicate).not.toHaveBeenCalled()
})

test('Should delete a list only after confirming', async () => {
  const { handlers, user } = setup()
  await openMenu(user)
  await user.click(screen.getByRole('button', { name: 'Borrar Bancos' }))
  expect(handlers.onDelete).not.toHaveBeenCalled()
  expect(screen.getByText('¿Borrar «Bancos»?')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Confirmar borrado de Bancos' }))
  expect(handlers.onDelete).toHaveBeenCalledWith('b')
})

test('Should keep the list when the deletion is cancelled', async () => {
  const { handlers, user } = setup()
  await openMenu(user)
  await user.click(screen.getByRole('button', { name: 'Borrar Bancos' }))
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(handlers.onDelete).not.toHaveBeenCalled()
  expect(screen.getByRole('menuitem', { name: 'Bancos' })).toBeTruthy()
})

test('Should not offer to delete the only list', async () => {
  const { handlers, user } = setup({ lists: [lists[0]] })
  await openMenu(user)
  const remove = screen.getByRole('button', { name: 'Borrar Tecnología' })
  expect(remove.hasAttribute('disabled')).toBe(true)
  await user.click(remove)
  expect(handlers.onDelete).not.toHaveBeenCalled()
})

test('Should close the menu with Escape', async () => {
  const { user } = setup()
  await openMenu(user)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).toBeNull()
})
