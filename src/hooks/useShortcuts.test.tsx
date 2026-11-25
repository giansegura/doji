import { act, fireEvent, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { Drawing } from '../../shared/types'
import { useShortcuts } from './useShortcuts'

const level = (id: string, value: number): Drawing => ({
  kind: 'hline',
  id,
  pane: 'price',
  timeframe: 'D',
  value,
  color: '#2962FF',
  width: 2,
  pricedAt: '2020-01-01',
})

const setup = (drawings: Drawing[] = []) => {
  const dispatch = vi.fn()
  const onTool = vi.fn()
  const onToggleList = vi.fn()
  const onHelp = vi.fn()
  const onSearch = vi.fn()
  const symbols = ['AAPL', 'MSFT', 'NVDA']
  const hook = renderHook(
    (props: { drawings: Drawing[]; symbol: string }) => useShortcuts({ ...props, symbols, dispatch, onTool, onToggleList, onHelp, onSearch }),
    { initialProps: { drawings, symbol: 'MSFT' } },
  )
  return { dispatch, onTool, onToggleList, onHelp, onSearch, ...hook }
}

test('Should save a change of drawings and give back the previous ones on Cmd+Z', () => {
  const before = [level('a', 10)]
  const after = [level('a', 20)]
  const { dispatch, result, rerender } = setup(before)
  act(() => result.current.changeDrawings(after))
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'setLines', symbol: 'MSFT', lines: after })
  rerender({ drawings: after, symbol: 'MSFT' })
  fireEvent.keyDown(window, { code: 'KeyZ', key: 'z', metaKey: true })
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'setLines', symbol: 'MSFT', lines: before })
})

test('Should redo with Shift what Cmd+Z undid', () => {
  const before = [level('a', 10)]
  const after = [level('a', 20)]
  const { dispatch, result, rerender } = setup(before)
  act(() => result.current.changeDrawings(after))
  rerender({ drawings: after, symbol: 'MSFT' })
  fireEvent.keyDown(window, { code: 'KeyZ', key: 'z', ctrlKey: true })
  rerender({ drawings: before, symbol: 'MSFT' })
  fireEvent.keyDown(window, { code: 'KeyZ', key: 'Z', ctrlKey: true, shiftKey: true })
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'setLines', symbol: 'MSFT', lines: after })
})

test('Should do nothing on Cmd+Z when there is nothing to undo', () => {
  const { dispatch } = setup()
  fireEvent.keyDown(window, { code: 'KeyZ', key: 'z', metaKey: true })
  expect(dispatch).not.toHaveBeenCalled()
})

test('Should move to the next and the previous symbol of the list with the arrows', () => {
  const { dispatch } = setup()
  fireEvent.keyDown(window, { code: 'ArrowDown', key: 'ArrowDown' })
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'setSymbol', symbol: 'NVDA' })
  fireEvent.keyDown(window, { code: 'ArrowUp', key: 'ArrowUp' })
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'setSymbol', symbol: 'AAPL' })
})

test('Should arm a drawing tool with Alt and its letter', () => {
  const { onTool } = setup()
  fireEvent.keyDown(window, { code: 'KeyH', key: '˙', altKey: true })
  expect(onTool).toHaveBeenCalledWith('hline')
})

test('Should keep the browser from also acting on a key it used, and leave the others alone', () => {
  setup()
  expect(fireEvent.keyDown(window, { code: 'ArrowDown', key: 'ArrowDown' })).toBe(false)
  expect(fireEvent.keyDown(window, { code: 'Space', key: ' ' })).toBe(true)
})

test('Should ignore the keys typed into a field', () => {
  const { dispatch, onTool } = setup()
  const field = document.createElement('input')
  document.body.append(field)
  fireEvent.keyDown(field, { code: 'ArrowDown', key: 'ArrowDown' })
  fireEvent.keyDown(field, { code: 'KeyT', key: 't', altKey: true })
  expect(dispatch).not.toHaveBeenCalled()
  expect(onTool).not.toHaveBeenCalled()
  field.remove()
})

test('Should have nothing to undo after the drawings are replaced from outside', () => {
  const before = [level('a', 10)]
  const after = [level('a', 20)]
  const { dispatch, result, rerender } = setup(before)
  act(() => result.current.changeDrawings(after))
  rerender({ drawings: after, symbol: 'MSFT' })
  act(() => result.current.forgetDrawings())
  dispatch.mockClear()
  fireEvent.keyDown(window, { code: 'KeyZ', key: 'z', metaKey: true })
  expect(dispatch).not.toHaveBeenCalled()
})

test('Should fold the watchlist with Alt+W and open the shortcuts with the question mark', () => {
  const { onToggleList, onHelp } = setup()
  fireEvent.keyDown(window, { code: 'KeyW', key: '∑', altKey: true })
  expect(onToggleList).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(window, { code: 'Slash', key: '?', shiftKey: true })
  expect(onHelp).toHaveBeenCalledTimes(1)
})

test('Should open the search with the character typed, unless a dialog is open', () => {
  const { onSearch } = setup()
  fireEvent.keyDown(window, { code: 'KeyK', key: 'k' })
  expect(onSearch).toHaveBeenCalledWith('k')
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  document.body.append(dialog)
  fireEvent.keyDown(window, { code: 'KeyP', key: 'p' })
  dialog.remove()
  expect(onSearch).toHaveBeenCalledTimes(1)
})

test('Should leave the chart, the list and the drawings alone while a modal dialog is open', () => {
  const { dispatch, onTool, onToggleList, onHelp } = setup([level('a', 1)])
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  document.body.append(dialog)
  fireEvent.keyDown(window, { code: 'ArrowDown', key: 'ArrowDown' })
  fireEvent.keyDown(window, { code: 'KeyH', key: '˙', altKey: true })
  fireEvent.keyDown(window, { code: 'KeyW', key: '∑', altKey: true })
  fireEvent.keyDown(window, { code: 'Slash', key: '?', shiftKey: true })
  fireEvent.keyDown(window, { code: 'KeyZ', key: 'z', metaKey: true })
  dialog.remove()
  expect([dispatch, onTool, onToggleList, onHelp].map((handler) => handler.mock.calls.length)).toEqual([0, 0, 0, 0])
  fireEvent.keyDown(window, { code: 'ArrowDown', key: 'ArrowDown' })
  expect(dispatch).toHaveBeenCalledTimes(1)
})
