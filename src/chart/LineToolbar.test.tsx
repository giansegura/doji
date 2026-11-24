import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Drawing, TrendLine } from '../../shared/types'
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

const base = { id: 'x', pane: 'price' as const, timeframe: 'D' as const, color: '#2962FF', width: 2, pricedAt: '2026-11-23' }

const others: Drawing[] = [
  { ...base, kind: 'hline', value: 210 },
  { ...base, kind: 'channel', p1: line.p1, p2: line.p2, offset: 10 },
  { ...base, kind: 'rect', p1: line.p1, p2: line.p2 },
]

test('Should offer to extend only a trend line', () => {
  others.forEach((drawing) => {
    const { unmount } = renderWithTheme(<LineToolbar line={drawing} onChange={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Extend right' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete line' })).toBeTruthy()
    unmount()
  })
})

test('Should change the colour and the width of any kind of drawing and keep the rest of it', async () => {
  const onChange = vi.fn()
  renderWithTheme(<LineToolbar line={others[1]} onChange={onChange} onDelete={vi.fn()} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Width 4' }))
  expect(onChange).toHaveBeenCalledWith({ ...others[1], width: 4 })
})

test('Should arm and disarm an alert on a trend line', async () => {
  const { handlers, user } = setup()
  const bell = screen.getByRole('button', { name: 'Alert' })
  expect(bell.getAttribute('aria-pressed')).toBe('false')
  await user.click(bell)
  expect(handlers.onChange).toHaveBeenCalledWith({ ...line, alert: true })
})

test('Should disarm an alert that is armed', async () => {
  const { handlers, user } = setup({ alert: true })
  const bell = screen.getByRole('button', { name: 'Alert' })
  expect(bell.getAttribute('aria-pressed')).toBe('true')
  await user.click(bell)
  expect(handlers.onChange).toHaveBeenCalledWith({ ...line, alert: false })
})

test('Should offer an alert on a horizontal line but not on a channel or a rectangle', () => {
  const offered = others.map((drawing) => {
    const { unmount } = renderWithTheme(<LineToolbar line={drawing} onChange={vi.fn()} onDelete={vi.fn()} />)
    const found = screen.queryByRole('button', { name: 'Alert' }) !== null
    unmount()
    return found
  })
  expect(offered).toEqual([true, false, false])
})

test('Should say that an alert has just been armed, and not when it is disarmed', async () => {
  const onArm = vi.fn()
  const first = renderWithTheme(<LineToolbar line={line} onChange={vi.fn()} onDelete={vi.fn()} onArm={onArm} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Alert' }))
  expect(onArm).toHaveBeenCalledTimes(1)
  first.unmount()
  renderWithTheme(<LineToolbar line={{ ...line, alert: true }} onChange={vi.fn()} onDelete={vi.fn()} onArm={onArm} />)
  await user.click(screen.getByRole('button', { name: 'Alert' }))
  expect(onArm).toHaveBeenCalledTimes(1)
})
