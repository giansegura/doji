import { screen, within } from '@testing-library/react'
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

test('Should keep the other tools of each group in its menu and pick them from there', async () => {
  const onTool = vi.fn()
  renderWithTheme(<LeftToolbar tool="cursor" onTool={onTool} />)
  const user = userEvent.setup()
  expect(screen.queryByRole('button', { name: 'Horizontal line' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'More line tools' }))
  const lines = screen.getByRole('menu', { name: 'Line tools' })
  expect(within(lines).getAllByRole('menuitem').map((item) => item.getAttribute('aria-label'))).toEqual([
    'Trend line',
    'Horizontal line',
    'Horizontal ray',
    'Vertical line',
  ])
  await user.click(within(lines).getByRole('menuitem', { name: 'Horizontal line' }))
  expect(screen.queryByRole('menu', { name: 'Line tools' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'More shapes' }))
  await user.click(screen.getByRole('menuitem', { name: 'Horizontal zone' }))
  await user.click(screen.getByRole('button', { name: 'Text' }))
  expect(onTool.mock.calls.map(([tool]) => tool)).toEqual(['hline', 'zone', 'note'])
})

test('Should show in each group the tool picked last, or the one armed', async () => {
  const onTool = vi.fn()
  const view = renderWithTheme(<LeftToolbar tool="cursor" onTool={onTool} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'More line tools' }))
  await user.click(screen.getByRole('menuitem', { name: 'Vertical line' }))
  expect(screen.getByRole('button', { name: 'Vertical line' })).toBeTruthy()
  view.unmount()
  renderWithTheme(<LeftToolbar tool="rect" onTool={onTool} />)
  expect(screen.getByRole('button', { name: 'Rectangle' }).getAttribute('aria-pressed')).toBe('true')
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

test('Should offer a long and a short position', async () => {
  const onTool = vi.fn()
  renderWithTheme(<LeftToolbar tool="cursor" onTool={onTool} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Long position' }))
  await user.click(screen.getByRole('button', { name: 'More position tools' }))
  await user.click(screen.getByRole('menuitem', { name: 'Short position' }))
  expect(onTool.mock.calls.map(([tool]) => tool)).toEqual(['long', 'short'])
})

test('Should hide every drawing, lock them and open their list from the bottom of the bar', async () => {
  const handlers = { onTool: vi.fn(), onHidden: vi.fn(), onLocked: vi.fn() }
  renderWithTheme(<LeftToolbar tool="cursor" hidden={false} locked={true} drawingsList={<div>Lista</div>} {...handlers} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Hide all drawings' }))
  expect(handlers.onHidden).toHaveBeenCalledWith(true)
  const lock = screen.getByRole('button', { name: 'Lock drawings' })
  expect(lock.getAttribute('aria-pressed')).toBe('true')
  await user.click(lock)
  expect(handlers.onLocked).toHaveBeenCalledWith(false)
  expect(screen.queryByText('Lista')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Drawings list' }))
  expect(screen.getByText('Lista')).toBeTruthy()
})
