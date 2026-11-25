import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../test/render'
import { RangeBar } from './RangeBar'

const setup = () => {
  const handlers = { onRange: vi.fn(), onGoTo: vi.fn() }
  renderWithTheme(<RangeBar {...handlers} />)
  return { handlers, user: userEvent.setup() }
}

test('Should show each span of time up to today', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Show 1 year' }))
  expect(handlers.onRange).toHaveBeenLastCalledWith('1Y')
  await user.click(screen.getByRole('button', { name: 'Show year to date' }))
  expect(handlers.onRange).toHaveBeenLastCalledWith('YTD')
  await user.click(screen.getByRole('button', { name: 'Show all' }))
  expect(handlers.onRange).toHaveBeenLastCalledWith('All')
})

test('Should go to the date written', async () => {
  const { handlers, user } = setup()
  const field = screen.getByLabelText('Go to date')
  fireEvent.change(field, { target: { value: '2024-03-15' } })
  await user.type(field, '{Enter}')
  expect(handlers.onGoTo).toHaveBeenCalledWith('2024-03-15')
})
