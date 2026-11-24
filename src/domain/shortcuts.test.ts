import { expect, test } from 'vitest'
import { type KeyLike, shortcutFor, stepSymbol } from './shortcuts'

const key = (over: Partial<KeyLike>): KeyLike => ({
  key: '',
  code: '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
})

test('Should undo with Cmd+Z or Ctrl+Z and redo with Shift added', () => {
  expect(shortcutFor(key({ code: 'KeyZ', metaKey: true }), false)).toEqual({ kind: 'undo' })
  expect(shortcutFor(key({ code: 'KeyZ', ctrlKey: true }), false)).toEqual({ kind: 'undo' })
  expect(shortcutFor(key({ code: 'KeyZ', metaKey: true, shiftKey: true }), false)).toEqual({ kind: 'redo' })
  expect(shortcutFor(key({ code: 'KeyY', ctrlKey: true }), false)).toEqual({ kind: 'redo' })
  expect(shortcutFor(key({ code: 'KeyZ' }), false)).toBeNull()
})

test('Should arm each drawing tool with Alt and its letter', () => {
  expect(shortcutFor(key({ code: 'KeyT', altKey: true }), false)).toEqual({ kind: 'tool', tool: 'trendline' })
  expect(shortcutFor(key({ code: 'KeyH', altKey: true }), false)).toEqual({ kind: 'tool', tool: 'hline' })
  expect(shortcutFor(key({ code: 'KeyC', altKey: true }), false)).toEqual({ kind: 'tool', tool: 'channel' })
  expect(shortcutFor(key({ code: 'KeyR', altKey: true }), false)).toEqual({ kind: 'tool', tool: 'rect' })
  expect(shortcutFor(key({ code: 'KeyT' }), false)).toBeNull()
  expect(shortcutFor(key({ code: 'KeyT', altKey: true, metaKey: true }), false)).toBeNull()
})

test('Should walk the watchlist with the up and down arrows', () => {
  expect(shortcutFor(key({ key: 'ArrowDown', code: 'ArrowDown' }), false)).toEqual({ kind: 'step', by: 1 })
  expect(shortcutFor(key({ key: 'ArrowUp', code: 'ArrowUp' }), false)).toEqual({ kind: 'step', by: -1 })
  expect(shortcutFor(key({ key: 'ArrowDown', code: 'ArrowDown', shiftKey: true }), false)).toBeNull()
  expect(shortcutFor(key({ key: 'ArrowDown', code: 'ArrowDown', metaKey: true }), false)).toBeNull()
})

test('Should leave every key alone while the user is typing', () => {
  expect(shortcutFor(key({ code: 'KeyZ', metaKey: true }), true)).toBeNull()
  expect(shortcutFor(key({ key: 'ArrowDown', code: 'ArrowDown' }), true)).toBeNull()
  expect(shortcutFor(key({ code: 'KeyT', altKey: true }), true)).toBeNull()
})

test('Should step to the next or the previous symbol of the list', () => {
  const list = ['AAPL', 'MSFT', 'NVDA']
  expect(stepSymbol(list, 'AAPL', 1)).toBe('MSFT')
  expect(stepSymbol(list, 'NVDA', -1)).toBe('MSFT')
  expect(stepSymbol(list, 'msft', 1)).toBe('NVDA')
})

test('Should stay on the first or the last symbol at the ends of the list', () => {
  const list = ['AAPL', 'MSFT', 'NVDA']
  expect(stepSymbol(list, 'NVDA', 1)).toBeNull()
  expect(stepSymbol(list, 'AAPL', -1)).toBeNull()
})

test('Should enter the list from a symbol that is not in it', () => {
  const list = ['AAPL', 'MSFT', 'NVDA']
  expect(stepSymbol(list, 'KO', 1)).toBe('AAPL')
  expect(stepSymbol(list, 'KO', -1)).toBe('NVDA')
  expect(stepSymbol([], 'KO', 1)).toBeNull()
})
