import { expect, test } from 'vitest'
import { barAtLogical } from './usePickBar'

const bars = [{ time: '2026-06-01' }, { time: '2026-06-02' }, { time: '2026-06-03' }]

test('Should pick the bar under the pointer, the nearest one past the edges and none without bars', () => {
  expect(barAtLogical(bars, 1.3)).toBe('2026-06-02')
  expect(barAtLogical(bars, 7)).toBe('2026-06-03')
  expect(barAtLogical(bars, -2)).toBe('2026-06-01')
  expect(barAtLogical(bars, undefined)).toBeNull()
  expect(barAtLogical([], 1)).toBeNull()
})
