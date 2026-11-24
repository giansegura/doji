import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { AlertToasts } from '.'

const fired = [
  { id: 'KO:a:1', text: 'KO crossed 100.00 going up', time: '15:32' },
  { id: 'PEP:b:2', text: 'PEP crossed 140.00 going down', time: '15:40' },
]

test('Should list every fired alert with the time it fired', () => {
  renderWithTheme(<AlertToasts fired={fired} onDismiss={vi.fn()} />)
  const items = screen.getAllByRole('status').map((item) => item.textContent)
  expect(items[0]).toContain('KO crossed 100.00 going up')
  expect(items[0]).toContain('15:32')
  expect(items[1]).toContain('PEP crossed 140.00 going down')
})

test('Should show nothing when no alert has fired', () => {
  renderWithTheme(<AlertToasts fired={[]} onDismiss={vi.fn()} />)
  expect(screen.queryByRole('status')).toBeNull()
})

test('Should dismiss the alert whose close button is pressed', async () => {
  const onDismiss = vi.fn()
  renderWithTheme(<AlertToasts fired={fired} onDismiss={onDismiss} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss PEP crossed 140.00 going down' }))
  expect(onDismiss).toHaveBeenCalledWith('PEP:b:2')
})
