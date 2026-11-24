import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { themes } from '../theme/tokens'
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

const openStyle = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Line style' }))

test('Should mark the current colour and report a new one', async () => {
  const { handlers, user } = setup()
  expect(pressed('Color #2962FF')).toBe('true')
  expect(pressed('Color #F23645')).toBe('false')
  await user.click(screen.getByRole('button', { name: 'Color #F23645' }))
  expect(handlers.onChange).toHaveBeenCalledWith({ ...line, color: '#F23645' })
})

test('Should mark the current width and report a new one', async () => {
  const { handlers, user } = setup()
  await openStyle(user)
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
  await openStyle(user)
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

test('Should not offer an alert on a drawing of the RSI pane', () => {
  setup({ pane: 'rsi' })
  expect(screen.queryByRole('button', { name: 'Alert' })).toBeNull()
})

test('Should offer white among the colours', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Color #FFFFFF' }))
  expect(handlers.onChange).toHaveBeenCalledWith({ ...line, color: '#FFFFFF' })
})

test('Should mark the current stroke and switch it to dashed, dotted or back to solid', async () => {
  const { handlers, user } = setup()
  await openStyle(user)
  expect(pressed('Solid line')).toBe('true')
  expect(pressed('Dashed line')).toBe('false')
  await user.click(screen.getByRole('button', { name: 'Dashed line' }))
  expect(handlers.onChange).toHaveBeenLastCalledWith({ ...line, lineStyle: 'dashed' })
  await user.click(screen.getByRole('button', { name: 'Dotted line' }))
  expect(handlers.onChange).toHaveBeenLastCalledWith({ ...line, lineStyle: 'dotted' })
})

test('Should turn a dashed line back to solid without leaving the setting behind', async () => {
  const { handlers, user } = setup({ lineStyle: 'dashed' })
  await openStyle(user)
  expect(pressed('Dashed line')).toBe('true')
  await user.click(screen.getByRole('button', { name: 'Solid line' }))
  expect(handlers.onChange).toHaveBeenCalledWith(line)
})

test('Should show the opacity in percent and change it from the slider', async () => {
  const { handlers, user } = setup({ opacity: 0.4 })
  await openStyle(user)
  const slider = screen.getByRole('slider', { name: 'Opacity' })
  expect(slider.getAttribute('value')).toBe('40')
  expect(screen.getByText('40%')).toBeTruthy()
  fireEvent.change(slider, { target: { value: '55' } })
  expect(handlers.onChange).toHaveBeenLastCalledWith({ ...line, opacity: 0.55 })
  fireEvent.change(slider, { target: { value: '100' } })
  expect(handlers.onChange).toHaveBeenLastCalledWith(line)
})

test('Should show a line fully opaque when it has no opacity of its own', async () => {
  const { user } = setup()
  await openStyle(user)
  expect(screen.getByRole('slider', { name: 'Opacity' }).getAttribute('value')).toBe('100')
})

test('Should hide and show again the price of a horizontal line on the axis', async () => {
  const hline = others[0]
  const onChange = vi.fn()
  const first = renderWithTheme(<LineToolbar line={hline} onChange={onChange} onDelete={vi.fn()} />)
  const user = userEvent.setup()
  expect(pressed('Price on the axis')).toBe('true')
  await user.click(screen.getByRole('button', { name: 'Price on the axis' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...hline, hidePrice: true })
  first.unmount()
  renderWithTheme(<LineToolbar line={{ ...hline, hidePrice: true } as Drawing} onChange={onChange} onDelete={vi.fn()} />)
  expect(pressed('Price on the axis')).toBe('false')
  await user.click(screen.getByRole('button', { name: 'Price on the axis' }))
  expect(onChange).toHaveBeenLastCalledWith(hline)
})

test('Should offer to hide the price only on a horizontal line', () => {
  setup()
  expect(screen.queryByRole('button', { name: 'Price on the axis' })).toBeNull()
})

test('Should write a text on a line and save it when leaving the field or pressing Enter', async () => {
  const { handlers, user } = setup()
  const field = screen.getByRole('textbox', { name: 'Text on the line' })
  await user.type(field, 'Soporte semanal')
  expect(handlers.onChange).not.toHaveBeenCalled()
  await user.keyboard('{Enter}')
  expect(handlers.onChange).toHaveBeenLastCalledWith({ ...line, text: 'Soporte semanal' })
  expect(handlers.onChange).toHaveBeenCalledTimes(1)
  expect(document.activeElement).not.toBe(field)
})

test('Should take the text away when the field is emptied', async () => {
  const { handlers, user } = setup({ text: 'R1' })
  const field = screen.getByRole('textbox', { name: 'Text on the line' })
  expect((field as HTMLInputElement).value).toBe('R1')
  await user.clear(field)
  await user.tab()
  expect(handlers.onChange).toHaveBeenLastCalledWith(line)
})

test('Should offer a text only on trend lines and horizontal lines', () => {
  const offered = others.map((drawing) => {
    const { unmount } = renderWithTheme(<LineToolbar line={drawing} onChange={vi.fn()} onDelete={vi.fn()} />)
    const found = screen.queryByRole('textbox', { name: 'Text on the line' }) !== null
    unmount()
    return found
  })
  expect(offered).toEqual([true, false, false])
})

test('Should keep the width, the stroke and the opacity in a panel that opens from the line style button', async () => {
  const { user } = setup({ lineStyle: 'dotted' })
  const button = screen.getByRole('button', { name: 'Line style' })
  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('group', { name: 'Line style' })).toBeNull()
  await user.click(button)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByRole('group', { name: 'Line style' })).toBeTruthy()
  await user.click(button)
  expect(screen.queryByRole('group', { name: 'Line style' })).toBeNull()
})

test('Should save a text typed without pressing Enter as soon as something else is pressed, and only once', async () => {
  const onChange = vi.fn()
  const { unmount } = renderWithTheme(<LineToolbar line={line} onChange={onChange} onDelete={vi.fn()} />)
  await userEvent.setup().type(screen.getByRole('textbox', { name: 'Text on the line' }), 'Techo')
  fireEvent.pointerDown(document.body)
  expect(onChange).toHaveBeenCalledWith({ ...line, text: 'Techo' })
  fireEvent.pointerDown(document.body)
  unmount()
  expect(onChange).toHaveBeenCalledTimes(1)
})

test('Should leave the drawings alone when the bar goes away with a text half typed', async () => {
  const onChange = vi.fn()
  const { unmount } = renderWithTheme(<LineToolbar line={line} onChange={onChange} onDelete={vi.fn()} />)
  await userEvent.setup().type(screen.getByRole('textbox', { name: 'Text on the line' }), 'Techo')
  unmount()
  expect(onChange).not.toHaveBeenCalled()
})

test('Should not leave the text field on Enter while a character is still being composed', async () => {
  const { handlers, user } = setup()
  const field = screen.getByRole('textbox', { name: 'Text on the line' })
  await user.type(field, 'R1')
  fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
  expect(document.activeElement).toBe(field)
  expect(handlers.onChange).not.toHaveBeenCalled()
})

test('Should follow a text changed elsewhere while the field is untouched, and never send it back', () => {
  const onChange = vi.fn()
  const ui = (text: string) => (
    <ThemeProvider theme={themes.midnight}>
      <LineToolbar line={{ ...line, text }} onChange={onChange} onDelete={vi.fn()} />
    </ThemeProvider>
  )
  const view = render(ui('R1'))
  view.rerender(ui('R2'))
  expect((screen.getByRole('textbox', { name: 'Text on the line' }) as HTMLInputElement).value).toBe('R2')
  fireEvent.pointerDown(document.body)
  expect(onChange).not.toHaveBeenCalled()
})

const position: Drawing = {
  ...base,
  kind: 'position',
  side: 'long',
  p1: line.p1,
  p2: { date: line.p2.date, value: line.p1.value },
  stop: 190,
  target: 220,
}

test('Should size a position from the account and the risk typed, saving each on Enter', async () => {
  const onChange = vi.fn()
  renderWithTheme(<LineToolbar line={position} onChange={onChange} onDelete={vi.fn()} />)
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Account size' }), '10000{Enter}')
  expect(onChange).toHaveBeenLastCalledWith({ ...position, account: 10000 })
  await user.type(screen.getByRole('textbox', { name: 'Risk %' }), '1.5{Enter}')
  expect(onChange).toHaveBeenLastCalledWith({ ...position, riskPercent: 1.5 })
})

test('Should clear the sizing of a position and ignore what is not a positive number', async () => {
  const onChange = vi.fn()
  renderWithTheme(<LineToolbar line={{ ...position, account: 5000 } as Drawing} onChange={onChange} onDelete={vi.fn()} />)
  const user = userEvent.setup()
  const account = screen.getByRole('textbox', { name: 'Account size' })
  expect((account as HTMLInputElement).value).toBe('5000')
  await user.clear(account)
  await user.keyboard('{Enter}')
  expect(onChange).toHaveBeenLastCalledWith(position)
  await user.type(screen.getByRole('textbox', { name: 'Risk %' }), 'mucho{Enter}')
  expect(onChange).toHaveBeenCalledTimes(1)
})

test('Should arm an alert on a position and offer no text on it', () => {
  renderWithTheme(<LineToolbar line={position} onChange={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Alert' })).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: 'Text on the line' })).toBeNull()
})
