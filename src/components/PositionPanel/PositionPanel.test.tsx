import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Holding } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { PositionPanel } from '.'

const setup = (holding?: Holding, price: number | null = 55) => {
  const onChange = vi.fn()
  renderWithTheme(<PositionPanel symbol="KO" holding={holding} price={price} currency="USD" onChange={onChange} />)
  return { onChange, user: userEvent.setup() }
}

test('Should stay folded and say the gain of the position when there is one', () => {
  setup({ quantity: 100, price: 50 })
  const toggle = screen.getByRole('button', { name: 'Position in KO' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(toggle.textContent).toContain('+10.00%')
  expect(toggle.textContent).toContain('+$500')
})

test('Should save the shares and the average price once both are valid', async () => {
  const { onChange, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Position in KO' }))
  await user.type(screen.getByRole('spinbutton', { name: 'Shares' }), '100')
  await user.type(screen.getByRole('spinbutton', { name: 'Average price' }), '58.2{Enter}')
  expect(onChange).toHaveBeenLastCalledWith({ quantity: 100, price: 58.2 })
})

test('Should not save a position without shares or price', async () => {
  const { onChange, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Position in KO' }))
  await user.type(screen.getByRole('spinbutton', { name: 'Shares' }), '0')
  await user.type(screen.getByRole('spinbutton', { name: 'Average price' }), '58.2{Enter}')
  expect(onChange).not.toHaveBeenCalled()
})

test('Should save a change to a position with Enter', async () => {
  const { onChange, user } = setup({ quantity: 100, price: 50 })
  await user.click(screen.getByRole('button', { name: 'Position in KO' }))
  const shares = screen.getByRole('spinbutton', { name: 'Shares' })
  await user.clear(shares)
  await user.type(shares, '150{Enter}')
  expect(onChange).toHaveBeenLastCalledWith({ quantity: 150, price: 50 })
})

test('Should remove the position', async () => {
  const { onChange, user } = setup({ quantity: 100, price: 50 })
  await user.click(screen.getByRole('button', { name: 'Position in KO' }))
  expect((screen.getByRole('spinbutton', { name: 'Shares' }) as HTMLInputElement).value).toBe('100')
  await user.click(screen.getByRole('button', { name: 'Remove position' }))
  expect(onChange).toHaveBeenLastCalledWith(null)
})
