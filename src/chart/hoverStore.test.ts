import { expect, test } from 'vitest'
import { createHoverStore } from './hoverStore'

test('Should start with no hovered bar', () => {
  expect(createHoverStore().get()).toBe(null)
})

test('Should tell its listeners when the hovered bar changes', () => {
  const store = createHoverStore()
  const seen: (number | null)[] = []
  store.subscribe(() => seen.push(store.get()))
  store.set(4)
  store.set(5)
  store.set(null)
  expect(seen).toEqual([4, 5, null])
})

test('Should stay quiet while the hovered bar is the same', () => {
  const store = createHoverStore()
  let told = 0
  store.subscribe(() => {
    told += 1
  })
  store.set(4)
  store.set(4)
  store.set(4)
  expect(told).toBe(1)
})

test('Should stop telling a listener that left', () => {
  const store = createHoverStore()
  let told = 0
  const leave = store.subscribe(() => {
    told += 1
  })
  leave()
  store.set(4)
  expect(told).toBe(0)
})
