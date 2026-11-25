import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { AlertEvent } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { AlertHistory } from '.'

const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute).toISOString()

const events: AlertEvent[] = [
  { id: 'b', symbol: 'EURUSD=X', level: 1.05, price: 1.0512, direction: 'up', at: at(25, 15, 3), text: 'Breakout' },
  { id: 'a', symbol: 'KO', level: 30, price: 29.4, direction: 'down', at: at(24, 9, 41), text: null, label: 'RSI 14 crosses 30' },
]

const setup = (shown: AlertEvent[] = events) => {
  const handlers = { onPick: vi.fn(), onClear: vi.fn() }
  renderWithTheme(<AlertHistory events={shown} {...handlers} />)
  return { ...handlers, user: userEvent.setup() }
}

test('Should list the alerts that went off, newest first, with when, what and at which price', () => {
  setup()
  const list = screen.getByRole('list', { name: 'Alert history' })
  const rows = within(list).getAllByRole('button')
  expect(rows.map((row) => row.textContent)).toEqual([
    '25 Nov 15:03EURUSDCrossed 1.0500 ▲1.0512',
    '24 Nov 09:41KORSI 14 crosses 30 ▼29.40',
  ])
  expect(rows[0].getAttribute('title')).toBe('Breakout')
})

test('Should open the chart of the alert clicked', async () => {
  const { onPick, user } = setup()
  await user.click(screen.getByRole('button', { name: /^KO/ }))
  expect(onPick).toHaveBeenCalledWith('KO')
})

test('Should clear the history', async () => {
  const { onClear, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Clear history' }))
  expect(onClear).toHaveBeenCalled()
})

test('Should say when no alert has gone off yet', () => {
  setup([])
  expect(screen.getByText('No alert has gone off yet')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Clear history' })).toBeNull()
})
