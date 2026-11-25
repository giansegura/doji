import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { ReplayBar } from '.'

const handlers = () => ({ onPickAgain: vi.fn(), onStep: vi.fn(), onTogglePlay: vi.fn(), onSpeed: vi.fn(), onExit: vi.fn() })

test('Should ask for the bar to start from while picking', async () => {
  const on = handlers()
  renderWithTheme(<ReplayBar replay={{ status: 'picking' }} {...on} />)
  expect(screen.getByRole('status').textContent).toBe('Click a bar on the chart to start the replay from it.')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Exit replay' }))
  expect(on.onExit).toHaveBeenCalled()
})

test('Should show the date being replayed and step, play, change speed, pick again and exit', async () => {
  const on = handlers()
  renderWithTheme(<ReplayBar replay={{ status: 'on', cutoff: '2026-06-10', playing: false, speed: 1 }} {...on} />)
  const user = userEvent.setup()
  expect(screen.getByText('Replaying Jun 10, 2026')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Step forward' }))
  await user.click(screen.getByRole('button', { name: 'Play' }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Replay speed' }), '3')
  await user.click(screen.getByRole('button', { name: 'Pick start' }))
  await user.click(screen.getByRole('button', { name: 'Exit replay' }))
  expect(on.onStep).toHaveBeenCalledTimes(1)
  expect(on.onTogglePlay).toHaveBeenCalledTimes(1)
  expect(on.onSpeed).toHaveBeenCalledWith(3)
  expect(on.onPickAgain).toHaveBeenCalledTimes(1)
  expect(on.onExit).toHaveBeenCalledTimes(1)
})

test('Should offer to pause while playing', () => {
  renderWithTheme(<ReplayBar replay={{ status: 'on', cutoff: '2026-06-10', playing: true, speed: 3 }} {...handlers()} />)
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
})
