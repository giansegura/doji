import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { IndicatorAlert, SmaConfig } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { IndicatorAlerts } from '.'

const averages: SmaConfig[] = [{ id: 's200', length: 200, color: '#fff', width: 1 }]

const setup = (alerts: IndicatorAlert[] = [], withAverages = averages) => {
  const handlers = { onAdd: vi.fn(), onArm: vi.fn(), onRemove: vi.fn() }
  renderWithTheme(<IndicatorAlerts symbol="KO" alerts={alerts} averages={withAverages} {...handlers} />)
  return { handlers, user: userEvent.setup() }
}

test('Should add an alert when the RSI crosses a value, 30 by default', async () => {
  const { handlers, user } = setup()
  expect(screen.getByText('No alerts for KO yet')).toBeTruthy()
  const value = screen.getByRole('spinbutton', { name: 'Value' }) as HTMLInputElement
  expect(value.value).toBe('30')
  await user.clear(value)
  await user.type(value, '70')
  await user.click(screen.getByRole('button', { name: 'Add alert' }))
  expect(handlers.onAdd).toHaveBeenCalledWith({ kind: 'rsi', value: 70, armed: true })
})

test('Should add an alert when the price crosses one of the averages, or a move of the day', async () => {
  const { handlers, user } = setup()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Condition' }), 'average')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Average' }), 's200')
  await user.click(screen.getByRole('button', { name: 'Add alert' }))
  expect(handlers.onAdd).toHaveBeenLastCalledWith({ kind: 'average', value: 0, averageId: 's200', armed: true })
  await user.selectOptions(screen.getByRole('combobox', { name: 'Condition' }), 'move')
  expect((screen.getByRole('spinbutton', { name: 'Value' }) as HTMLInputElement).value).toBe('3')
  await user.click(screen.getByRole('button', { name: 'Add alert' }))
  expect(handlers.onAdd).toHaveBeenLastCalledWith({ kind: 'move', value: 3, armed: true })
})

test('Should not offer an alert on an average when there is none', async () => {
  const { user } = setup([], [])
  await user.selectOptions(screen.getByRole('combobox', { name: 'Condition' }), 'average')
  expect(screen.getByText('Add a moving average first')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Add alert' }) as HTMLButtonElement).disabled).toBe(true)
})

test('Should list the alerts of the symbol to arm, disarm or remove them', async () => {
  const { handlers, user } = setup([{ id: 'r', kind: 'rsi', value: 30, armed: false }])
  const toggle = screen.getByRole('checkbox', { name: 'RSI 14 crosses 30' }) as HTMLInputElement
  expect(toggle.checked).toBe(false)
  await user.click(toggle)
  expect(handlers.onArm).toHaveBeenCalledWith('r', true)
  await user.click(screen.getByRole('button', { name: 'Remove alert RSI 14 crosses 30' }))
  expect(handlers.onRemove).toHaveBeenCalledWith('r')
})
