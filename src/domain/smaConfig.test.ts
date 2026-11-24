import { expect, test } from 'vitest'
import { MAX_SMAS, SMA_COLORS } from '../../shared/limits'
import type { SmaConfig } from '../../shared/types'
import { addSma, clampSmaLength, clampSmaWidth } from './smaConfig'

const ids = () => {
  let counter = 0
  return () => {
    counter += 1
    return `id${counter}`
  }
}

const sma = (id: string, length: number, color = SMA_COLORS[0]): SmaConfig => ({ id, length, color, width: 1 })

test('Should start with a 20-period average in the first colour', () => {
  expect(addSma([], ids())).toEqual([{ id: 'id1', length: 20, color: SMA_COLORS[0], width: 1 }])
})

test('Should follow with 50 and 200 in the next colours', () => {
  const newId = ids()
  const out = addSma(addSma(addSma([], newId), newId), newId)
  expect(out.map((item) => item.length)).toEqual([20, 50, 200])
  expect(out.map((item) => item.color)).toEqual([SMA_COLORS[0], SMA_COLORS[1], SMA_COLORS[2]])
})

test('Should pick the first usual length and colour not already in use', () => {
  const out = addSma([sma('a', 20, SMA_COLORS[1]), sma('b', 200, SMA_COLORS[0])], ids())
  expect(out[2]).toEqual({ id: 'id1', length: 50, color: SMA_COLORS[2], width: 1 })
})

test('Should keep the existing averages untouched', () => {
  const existing = [sma('a', 7)]
  expect(addSma(existing, ids())[0]).toBe(existing[0])
})

test('Should not add beyond the maximum', () => {
  const full = Array.from({ length: MAX_SMAS }, (_, index) => sma(`s${index}`, 10 + index))
  expect(addSma(full, ids())).toBe(full)
})

test('Should offer at least sixteen distinct colours', () => {
  expect(SMA_COLORS.length).toBeGreaterThanOrEqual(16)
  expect(new Set(SMA_COLORS).size).toBe(SMA_COLORS.length)
  expect(SMA_COLORS.every((color) => /^#[0-9A-F]{6}$/.test(color))).toBe(true)
})

test('Should clamp a width to whole numbers between 1 and 4', () => {
  expect(clampSmaWidth(0)).toBe(1)
  expect(clampSmaWidth(9)).toBe(4)
  expect(clampSmaWidth(2.6)).toBe(2)
  expect(clampSmaWidth(3)).toBe(3)
})

test('Should clamp a period to whole numbers between 1 and 500', () => {
  expect(clampSmaLength(0)).toBe(1)
  expect(clampSmaLength(999)).toBe(500)
  expect(clampSmaLength(50)).toBe(50)
  expect(clampSmaLength(20.7)).toBe(20)
})
