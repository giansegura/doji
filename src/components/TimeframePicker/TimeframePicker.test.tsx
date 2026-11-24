import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { TimeframePicker } from '.'

test('Should offer the three timeframes and mark the current one', () => {
  renderWithTheme(<TimeframePicker label="Second chart timeframe" value="W" onChange={vi.fn()} />)
  expect(screen.getByRole('group', { name: 'Second chart timeframe' })).toBeTruthy()
  expect(screen.getAllByRole('button').map((button) => [button.textContent, button.getAttribute('aria-pressed')])).toEqual([
    ['D', 'false'],
    ['W', 'true'],
    ['M', 'false'],
  ])
})

test('Should report the chosen timeframe', async () => {
  const onChange = vi.fn()
  renderWithTheme(<TimeframePicker label="Second chart timeframe" value="W" onChange={onChange} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'M' }))
  expect(onChange).toHaveBeenCalledWith('M')
})
