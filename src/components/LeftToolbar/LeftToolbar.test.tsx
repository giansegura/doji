import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { LeftToolbar } from '.'

test('Should mark the active tool', () => {
  renderWithTheme(<LeftToolbar tool="trendline" onTool={() => undefined} />)
  expect(screen.getByRole('button', { name: 'Línea de tendencia' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Cursor' }).getAttribute('aria-pressed')).toBe('false')
})

test('Should report the chosen tool', async () => {
  const onTool = vi.fn()
  renderWithTheme(<LeftToolbar tool="cursor" onTool={onTool} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Línea de tendencia' }))
  expect(onTool).toHaveBeenCalledWith('trendline')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cursor' }))
  expect(onTool).toHaveBeenLastCalledWith('cursor')
})
