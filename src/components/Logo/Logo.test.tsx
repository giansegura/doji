import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { Logo } from '.'

test('Should draw the doji mark at the size asked, named for screen readers', () => {
  renderWithTheme(<Logo size={22} />)
  const mark = screen.getByRole('img', { name: 'doji' })
  expect(mark.getAttribute('width')).toBe('22')
  expect(mark.getAttribute('height')).toBe('22')
  expect(mark.querySelectorAll('rect')).toHaveLength(7)
})

test('Should paint the tile with the doji violet whatever the theme', () => {
  renderWithTheme(<Logo size={22} />)
  expect(screen.getByRole('img', { name: 'doji' }).querySelector('rect')?.getAttribute('fill')).toBe('#7C5CFF')
})
