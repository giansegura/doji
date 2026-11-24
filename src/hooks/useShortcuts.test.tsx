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
  const symbols = ['AAPL', 'MSFT', 'NVDA']
  const hook = renderHook((props: { drawings: Drawing[]; symbol: string }) => useShortcuts({ ...props, symbols, dispatch, onTool }), {
    initialProps: { drawings, symbol: 'MSFT' },
  })
  return { dispatch, onTool, ...hook }
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
  expect(fireEvent.keyDown(window, { code: 'KeyQ', key: 'q' })).toBe(true)
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
