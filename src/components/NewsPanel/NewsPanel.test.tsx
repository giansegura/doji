import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { NewsItem } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { NewsPanel } from '.'

const NOW = Date.parse('2026-11-25T15:00:00Z')

const headlines: NewsItem[] = [
  { id: 'n1', title: 'Coca-Cola raises its dividend', publisher: 'Reuters', time: NOW - 3 * 3_600_000, url: 'https://example.com/n1' },
]

const setup = (news: NewsItem[] | null | undefined, open = true) => {
  const onToggle = vi.fn()
  renderWithTheme(<NewsPanel symbol="KO" open={open} news={news} now={NOW} onToggle={onToggle} />)
  return { onToggle, user: userEvent.setup() }
}

test('Should stay folded until asked', async () => {
  const { onToggle, user } = setup(undefined, false)
  const toggle = screen.getByRole('button', { name: 'News for KO' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  await user.click(toggle)
  expect(onToggle).toHaveBeenCalled()
})

test('Should list each headline with its source and how long ago, opening it in another tab', () => {
  setup(headlines)
  const link = screen.getByRole('link', { name: 'Coca-Cola raises its dividend' })
  expect(link.getAttribute('href')).toBe('https://example.com/n1')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noreferrer')
  expect(screen.getByText('Reuters · 3h ago')).toBeTruthy()
})

test('Should say while it loads', () => {
  setup(undefined)
  expect(screen.getByText('Loading…')).toBeTruthy()
})

test('Should say when there are no recent headlines', () => {
  setup([])
  expect(screen.getByText('No recent headlines for KO')).toBeTruthy()
})

test('Should say when the headlines could not be read', () => {
  setup(null)
  expect(screen.getByText('Could not load the headlines')).toBeTruthy()
})
