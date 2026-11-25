import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { ListResizer } from '.'

const setup = (width = 320, extraColumns = 0) => {
  const onResize = vi.fn()
  renderWithTheme(<ListResizer width={width} extraColumns={extraColumns} onResize={onResize} />)
  const separator = screen.getByRole('separator', { name: 'Watchlist width' })
  const widths = () => onResize.mock.calls.map(([value]) => value as number)
  return { onResize, separator, widths }
}

test('Should describe itself as a vertical separator with the current width and its limits', () => {
  const { separator } = setup(400)
  expect(separator.getAttribute('aria-orientation')).toBe('vertical')
  expect(separator.getAttribute('aria-valuenow')).toBe('400')
  expect(separator.getAttribute('aria-valuemin')).toBe('220')
  expect(separator.getAttribute('aria-valuemax')).toBe('640')
})

test('Should widen the list when dragged to the left', () => {
  const { separator, widths } = setup()
  fireEvent.pointerDown(separator, { button: 0, clientX: 1000 })
  fireEvent.pointerMove(window, { clientX: 940 })
  expect(widths()).toEqual([380])
})

test('Should narrow the list when dragged to the right', () => {
  const { separator, widths } = setup()
  fireEvent.pointerDown(separator, { button: 0, clientX: 1000 })
  fireEvent.pointerMove(window, { clientX: 1050 })
  expect(widths()).toEqual([270])
})

test('Should measure the drag from where it started', () => {
  const { separator, widths } = setup()
  fireEvent.pointerDown(separator, { button: 0, clientX: 1000 })
  fireEvent.pointerMove(window, { clientX: 990 })
  fireEvent.pointerMove(window, { clientX: 980 })
  expect(widths()).toEqual([330, 340])
})

test('Should stop at the narrowest and the widest list allowed', () => {
  const { separator, widths } = setup()
  fireEvent.pointerDown(separator, { button: 0, clientX: 1000 })
  fireEvent.pointerMove(window, { clientX: 1900 })
  fireEvent.pointerMove(window, { clientX: 10 })
  expect(widths()).toEqual([220, 640])
})

test('Should stop following the pointer once it is released', () => {
  const { separator, widths } = setup()
  fireEvent.pointerDown(separator, { button: 0, clientX: 1000 })
  fireEvent.pointerUp(window, { clientX: 1000 })
  fireEvent.pointerMove(window, { clientX: 900 })
  fireEvent.pointerDown(separator, { button: 0, clientX: 1000 })
  fireEvent.pointerCancel(window)
  fireEvent.pointerMove(window, { clientX: 900 })
  expect(widths()).toEqual([])
})

test('Should not follow the pointer before it is pressed or with another button', () => {
  const { separator, widths } = setup()
  fireEvent.pointerMove(window, { clientX: 900 })
  fireEvent.pointerDown(separator, { button: 2, clientX: 1000 })
  fireEvent.pointerMove(window, { clientX: 900 })
  expect(widths()).toEqual([])
})

test('Should resize with the arrow keys', async () => {
  const { separator, widths } = setup()
  const user = userEvent.setup()
  separator.focus()
  await user.keyboard('{ArrowLeft}')
  await user.keyboard('{ArrowRight}')
  expect(widths()).toEqual([336, 304])
})

test('Should let the list grow wider when it shows extra columns', () => {
  const { separator, widths } = setup(400, 2)
  expect(separator.getAttribute('aria-valuemax')).toBe('768')
  fireEvent.pointerDown(separator, { button: 0, clientX: 1000 })
  fireEvent.pointerMove(window, { clientX: 10 })
  expect(widths()).toEqual([768])
})
