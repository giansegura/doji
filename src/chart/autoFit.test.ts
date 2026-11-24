import { expect, test } from 'vitest'
import type { PaneId } from '../../shared/types'
import { createAutoFit } from './autoFit'

type Fake = { auto: boolean; writes: boolean[] }

const setup = (initial: Partial<Record<PaneId, boolean | null>> = {}) => {
  const state = { price: true, rsi: true, ...initial }
  const fakes: Record<PaneId, Fake | null> = {
    price: state.price === null ? null : { auto: state.price, writes: [] },
    rsi: state.rsi === null ? null : { auto: state.rsi, writes: [] },
  }
  const changes: boolean[] = []
  const autoFit = createAutoFit({
    panes: ['price', 'rsi'],
    scale: (pane) => {
      const fake = fakes[pane]
      if (!fake) return null
      return {
        isAuto: () => fake.auto,
        setAuto: (auto) => {
          fake.auto = auto
          fake.writes.push(auto)
        },
      }
    },
    onChange: (manual) => {
      changes.push(manual)
    },
  })
  return { autoFit, fakes, changes }
}

test('Should let go of the automatic fit of the pane being dragged', () => {
  const { autoFit, fakes, changes } = setup()
  autoFit.release('price')
  expect(fakes.price?.auto).toBe(false)
  expect(fakes.rsi?.auto).toBe(true)
  expect(changes.at(-1)).toBe(true)
})

test('Should leave alone a pane that is already free', () => {
  const { autoFit, fakes, changes } = setup({ rsi: false })
  autoFit.release('rsi')
  expect(fakes.rsi?.writes).toEqual([])
  expect(changes.at(-1)).toBe(true)
})

test('Should do nothing for a pane that is not there', () => {
  const { autoFit, fakes, changes } = setup({ rsi: null })
  autoFit.release('rsi')
  expect(fakes.price?.writes).toEqual([])
  expect(changes.at(-1)).toBe(false)
})

test('Should fit again every pane that was free', () => {
  const { autoFit, fakes, changes } = setup({ price: false, rsi: false })
  autoFit.fit()
  expect(fakes.price?.auto).toBe(true)
  expect(fakes.rsi?.auto).toBe(true)
  expect(changes.at(-1)).toBe(false)
})

test('Should not touch the panes that were already fitted', () => {
  const { autoFit, fakes } = setup({ price: false })
  autoFit.fit()
  expect(fakes.price?.writes).toEqual([true])
  expect(fakes.rsi?.writes).toEqual([])
})

test('Should notice a pane freed or fitted by the chart itself', () => {
  const { autoFit, fakes, changes } = setup()
  autoFit.sync()
  expect(changes.at(-1)).toBe(false)
  if (fakes.rsi) fakes.rsi.auto = false
  autoFit.sync()
  expect(changes.at(-1)).toBe(true)
  if (fakes.rsi) fakes.rsi.auto = true
  autoFit.sync()
  expect(changes.at(-1)).toBe(false)
})
