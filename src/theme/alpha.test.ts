import { expect, test } from 'vitest'
import { withAlpha } from './alpha'

test('Should turn a colour into its translucent version', () => {
  expect(withAlpha('#2962FF', 0.28)).toBe('rgba(41, 98, 255, 0.28)')
  expect(withAlpha('#7c5cff', 0.04)).toBe('rgba(124, 92, 255, 0.04)')
})

test('Should leave alone a colour it cannot read', () => {
  expect(withAlpha('rgba(1, 2, 3, 0.5)', 0.2)).toBe('rgba(1, 2, 3, 0.5)')
  expect(withAlpha('#FFF', 0.2)).toBe('#FFF')
})
