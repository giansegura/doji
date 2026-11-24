import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { TrendLine } from '../../shared/types'
import { renderWithTheme } from '../test/render'
import { LineToolbar } from './LineToolbar'

const line: TrendLine = {
  id: 'a',
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2026-11-02', value: 200 },
  p2: { date: '2026-11-20', value: 230 },
  color: '#2962FF',
  width: 2,
  extendRight: false,
  pricedAt: '2026-11-23',
}

const setup = (over: Partial<TrendLine> = {}) => {
  const handlers = { onChange: vi.fn(), onDelete: vi.fn() }
  renderWithTheme(<LineToolbar line={{ ...line, ...over }} {...handlers} />)
  return { handlers, user: userEvent.setup() }
}

const pressed = (name: string): string | null => screen.getByRole('button', { name }).getAttribute('aria-pressed')

test('Should mark the current colour and report a new one', async () => {
  const { handlers, user } = setup()
  expect(pressed('Color #2962FF')).toBe('true')
  expect(pressed('Color #F23645')).toBe('false')
  await user.click(screen.getByRole('button', { name: 'Color #F23645' }))
  expect(handlers.onChange).toHaveBeenCalledWith({ ...line, color: '#F23645' })
})

test('Should mark the current width and report a new one', async () => {
  const { handlers, user } = setup()
  expect(pressed('Width 2')).toBe('true')
  expect(pressed('Width 4')).toBe('false')
  await user.click(screen.getByRole('button', { name: 'Width 4' }))
  expect(handlers.onChange).toHaveBeenCalledWith({ ...line, width: 4 })
})

test('Should toggle extend right both ways', async () => {
  const on = setup()
  expect(pressed('Extend right')).toBe('false')
  await on.user.click(screen.getByRole('button', { name: 'Extend right' }))
  expect(on.handlers.onChange).toHaveBeenCalledWith({ ...line, extendRight: true })
})

test('Should switch extend right off when it is on', async () => {
  const { handlers, user } = setup({ extendRight: true })
  expect(pressed('Extend right')).toBe('true')
  await user.click(screen.getByRole('button', { name: 'Extend right' }))
  expect(handlers.onChange).toHaveBeenCalledWith({ ...line, extendRight: false })
})

test('Should delete the line', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Delete line' }))
  expect(handlers.onDelete).toHaveBeenCalledTimes(1)
  expect(handlers.onChange).not.toHaveBeenCalled()
})
