import { expect, test } from 'vitest'
import type { Drawing } from '../../shared/types'
import { createLinesHistory } from './linesHistory'

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

const setup = (limit?: number) => {
  let clock = 1_000_000
  const history = createLinesHistory({ now: () => clock, limit })
  const wait = (ms: number) => {
    clock += ms
  }
  return { history, wait }
}

const none: Drawing[] = []
const one = [level('a', 10)]
const moved = [level('a', 20)]
const two = [level('a', 20), level('b', 5)]

test('Should give back the drawings as they were before the last change', () => {
  const { history } = setup()
  history.record('KO', none)
  expect(history.undo('KO', one)).toBe(none)
})

test('Should have nothing to undo before any change, or once everything is undone', () => {
  const { history } = setup()
  expect(history.undo('KO', one)).toBeNull()
  history.record('KO', none)
  history.undo('KO', one)
  expect(history.undo('KO', none)).toBeNull()
})

test('Should undo several changes one at a time, the latest first', () => {
  const { history, wait } = setup()
  history.record('KO', none)
  wait(1000)
  history.record('KO', one)
  wait(1000)
  history.record('KO', moved)
  expect(history.undo('KO', two)).toBe(moved)
  expect(history.undo('KO', moved)).toBe(one)
  expect(history.undo('KO', one)).toBe(none)
})

test('Should count the many small changes of one drag as a single change', () => {
  const { history, wait } = setup()
  history.record('KO', one)
  wait(30)
  history.record('KO', [level('a', 12)])
  wait(30)
  history.record('KO', [level('a', 15)])
  expect(history.undo('KO', moved)).toBe(one)
  expect(history.undo('KO', one)).toBeNull()
})

test('Should redo what was undone', () => {
  const { history } = setup()
  history.record('KO', none)
  history.undo('KO', one)
  expect(history.redo('KO', none)).toBe(one)
  expect(history.redo('KO', one)).toBeNull()
  expect(history.undo('KO', one)).toBe(none)
})

test('Should forget what could be redone once something new is drawn', () => {
  const { history, wait } = setup()
  history.record('KO', none)
  history.undo('KO', one)
  wait(1000)
  history.record('KO', none)
  expect(history.redo('KO', moved)).toBeNull()
})

test('Should keep the changes of each symbol apart', () => {
  const { history, wait } = setup()
  history.record('KO', none)
  wait(1000)
  history.record('PEP', one)
  expect(history.undo('MSFT', two)).toBeNull()
  expect(history.undo('PEP', two)).toBe(one)
  expect(history.undo('KO', one)).toBe(none)
})

test('Should not merge changes of different symbols made close together', () => {
  const { history } = setup()
  history.record('KO', none)
  history.record('PEP', one)
  expect(history.undo('PEP', two)).toBe(one)
})

test('Should remember only the latest changes once there are too many', () => {
  const { history, wait } = setup(2)
  ;[none, one, moved].forEach((before) => {
    history.record('KO', before)
    wait(1000)
  })
  expect(history.undo('KO', two)).toBe(moved)
  expect(history.undo('KO', moved)).toBe(one)
  expect(history.undo('KO', one)).toBeNull()
})

test('Should have nothing left to undo or redo once it is cleared', () => {
  const { history } = setup()
  history.record('KO', none)
  history.undo('KO', one)
  history.record('PEP', one)
  history.clear()
  expect(history.undo('PEP', two)).toBeNull()
  expect(history.redo('KO', none)).toBeNull()
})
