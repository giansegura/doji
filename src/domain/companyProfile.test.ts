import { expect, test } from 'vitest'
import type { CompanyProfile } from '../../shared/types'
import { earningsDay, profileRows } from './companyProfile'

const apple: CompanyProfile = {
  kind: 'EQUITY',
  name: 'Apple Inc.',
  currency: 'USD',
  marketCap: 5_145_409_617_920,
  totalAssets: null,
  trailingPE: 39.428,
  forwardPE: 33.489,
  dividendYield: 0.0031,
  beta: 1.089,
  high52: 360.83,
  low52: 243.42,
  sector: 'Technology',
  industry: 'Consumer Electronics',
  category: null,
  country: 'United States',
  employees: 167000,
  website: 'https://www.apple.com',
  summary: 'Apple Inc. designs smartphones.',
}

test('Should list the main figures of a company in a few short rows', () => {
  expect(profileRows(apple, 'AAPL', 'Jan 28, 2027')).toEqual([
    { label: 'Market cap', value: '$5.15T' },
    { label: 'P/E', value: '39.43 · forward 33.49' },
    { label: 'Dividend yield', value: '0.31%' },
    { label: '52-week range', value: '243.42 – 360.83' },
    { label: 'Sector', value: 'Technology · Consumer Electronics' },
    { label: 'Next earnings', value: 'Jan 28, 2027' },
    { label: 'Beta', value: '1.09' },
    { label: 'Employees', value: '167,000' },
    { label: 'Country', value: 'United States' },
  ])
})

test('Should show the assets and the category of a fund and leave out what it does not have', () => {
  const fund: CompanyProfile = {
    ...apple,
    kind: 'ETF',
    marketCap: null,
    totalAssets: 796_865_200_128,
    forwardPE: null,
    dividendYield: 0.01,
    sector: null,
    industry: null,
    category: 'Large Blend',
    beta: null,
    employees: null,
    country: null,
  }
  expect(profileRows(fund, 'SPY', null)).toEqual([
    { label: 'Total assets', value: '$796.87B' },
    { label: 'P/E', value: '39.43' },
    { label: 'Dividend yield', value: '1.00%' },
    { label: '52-week range', value: '243.42 – 360.83' },
    { label: 'Category', value: 'Large Blend' },
  ])
})

test('Should write the day of the next earnings, marked when it is only an estimate', () => {
  expect(earningsDay({ past: [], next: '2027-01-28', nextIsEstimate: false })).toBe('Jan 28, 2027')
  expect(earningsDay({ past: [], next: '2027-01-28', nextIsEstimate: true })).toBe('~Jan 28, 2027')
  expect(earningsDay({ past: [], next: null, nextIsEstimate: false })).toBeNull()
  expect(earningsDay(null)).toBeNull()
})
