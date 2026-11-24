import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { NotesPanel } from '.'

const setup = (text = '') => {
  const onChange = vi.fn()
  const view = renderWithTheme(<NotesPanel symbol="KO" text={text} onChange={onChange} />)
  return { onChange, user: userEvent.setup(), ...view }
}

test('Should stay folded until asked and say which symbol the notes are for', () => {
  setup()
  const toggle = screen.getByRole('button', { name: 'Notes for KO' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('textbox', { name: 'Notes for KO' })).toBeNull()
})

test('Should show the note of the symbol once unfolded', async () => {
  const { user } = setup('Comprar por debajo de 60')
  await user.click(screen.getByRole('button', { name: 'Notes for KO' }))
  expect((screen.getByRole('textbox', { name: 'Notes for KO' }) as HTMLTextAreaElement).value).toBe('Comprar por debajo de 60')
})

test('Should report what is written', async () => {
  const { onChange, user } = setup('Tesi')
  await user.click(screen.getByRole('button', { name: 'Notes for KO' }))
  await user.type(screen.getByRole('textbox', { name: 'Notes for KO' }), 's')
  expect(onChange).toHaveBeenLastCalledWith('Tesis')
})

test('Should mark that a symbol has a note even while folded', () => {
  setup('Tesis')
  expect(screen.getByRole('img', { name: 'Has a note' })).toBeTruthy()
})

test('Should not mark a symbol without a note', () => {
  setup()
  expect(screen.queryByRole('img', { name: 'Has a note' })).toBeNull()
})

test('Should fold again and keep the note', async () => {
  const { user } = setup('Tesis')
  const toggle = screen.getByRole('button', { name: 'Notes for KO' })
  await user.click(toggle)
  await user.click(toggle)
  expect(screen.queryByRole('textbox', { name: 'Notes for KO' })).toBeNull()
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
})
