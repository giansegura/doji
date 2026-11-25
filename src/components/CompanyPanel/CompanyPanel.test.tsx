import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { CompanyProfile } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { CompanyPanel } from '.'

const profile: CompanyProfile = {
  kind: 'EQUITY',
  name: 'The Coca-Cola Company',
  currency: 'USD',
  marketCap: 290_000_000_000,
  totalAssets: null,
  trailingPE: 25.1,
  forwardPE: null,
  dividendYield: 0.029,
  beta: null,
  high52: 74.38,
  low52: 60.62,
  sector: 'Consumer Defensive',
  industry: 'Beverages',
  category: null,
  country: null,
  employees: null,
  website: 'https://www.coca-colacompany.com',
  summary: 'The Coca-Cola Company makes drinks.',
}

const setup = (shown: CompanyProfile | null | undefined, open = false) => {
  const onToggle = vi.fn()
  renderWithTheme(<CompanyPanel symbol="KO" open={open} profile={shown} nextEarnings="Feb 10, 2027" onToggle={onToggle} />)
  return { onToggle, user: userEvent.setup() }
}

test('Should stay folded until asked', async () => {
  const { onToggle, user } = setup(undefined)
  const toggle = screen.getByRole('button', { name: 'Company sheet for KO' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByText('Market cap')).toBeNull()
  await user.click(toggle)
  expect(onToggle).toHaveBeenCalled()
})

test('Should show the figures, the description and the website of the company', () => {
  setup(profile, true)
  expect(screen.getByText('$290B')).toBeTruthy()
  expect(screen.getByText('2.90%')).toBeTruthy()
  expect(screen.getByText('Consumer Defensive · Beverages')).toBeTruthy()
  expect(screen.getByText('Feb 10, 2027')).toBeTruthy()
  expect(screen.getByText('The Coca-Cola Company makes drinks.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'coca-colacompany.com' }).getAttribute('href')).toBe('https://www.coca-colacompany.com')
})

test('Should say while it loads and when Yahoo has no sheet', () => {
  setup(undefined, true)
  expect(screen.getByText('Loading…')).toBeTruthy()
})

test('Should say when there is no sheet for the symbol', () => {
  setup(null, true)
  expect(screen.getByText('No company data for KO')).toBeTruthy()
})
