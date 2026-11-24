import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { LeftToolbar } from '.'

test('Should mark the active tool', () => {
  renderWithTheme(<LeftToolbar tool="trendline" onTool={() => undefined} />)
  expect(screen.getByRole('button', { name: 'Trend line' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Cursor' }).getAttribute('aria-pressed')).toBe('false')
})

test('Should report the chosen tool', async () => {
  const onTool = vi.fn()
  renderWithTheme(<LeftToolbar tool="cursor" onTool={onTool} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Trend line' }))
  expect(onTool).toHaveBeenCalledWith('trendline')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cursor' }))
  expect(onTool).toHaveBeenLastCalledWith('cursor')
})

test('Should offer the horizontal line, the parallel channel and the rectangle', async () => {
  const onTool = vi.fn()
  renderWithTheme(<LeftToolbar tool="cursor" onTool={onTool} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Horizontal line' }))
  await user.click(screen.getByRole('button', { name: 'Parallel channel' }))
  await user.click(screen.getByRole('button', { name: 'Rectangle' }))
  expect(onTool.mock.calls.map(([tool]) => tool)).toEqual(['hline', 'channel', 'rect'])
})

test('Should mark whichever drawing tool is armed', () => {
  renderWithTheme(<LeftToolbar tool="channel" onTool={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Parallel channel' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Trend line' }).getAttribute('aria-pressed')).toBe('false')
})

test('Should offer the ruler to measure and mark it while armed', async () => {
  const onTool = vi.fn()
  renderWithTheme(<LeftToolbar tool="measure" onTool={onTool} />)
  const ruler = screen.getByRole('button', { name: 'Measure' })
  expect(ruler.getAttribute('aria-pressed')).toBe('true')
  await userEvent.setup().click(ruler)
  expect(onTool).toHaveBeenCalledWith('measure')
})
