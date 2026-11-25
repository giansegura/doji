import type { CompanyProfile, Earnings } from '../../shared/types'
import { formatPrice } from '../chart/format'

export type ProfileRow = { label: string; value: string }

const amount = (value: number, currency: string | null): string =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...(currency ? { style: 'currency', currency, currencyDisplay: 'narrowSymbol' } : {}),
  }).format(value)

const LONG_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export const earningsDay = (earnings: Earnings | null): string | null =>
  earnings?.next ? `${earnings.nextIsEstimate ? '~' : ''}${LONG_DAY.format(new Date(`${earnings.next}T00:00:00Z`))}` : null

const twoDecimals = (value: number): string => value.toFixed(2)

const joined = (parts: (string | null)[]): string | null => {
  const present = parts.filter((part): part is string => part !== null)
  return present.length > 0 ? present.join(' · ') : null
}

export const profileRows = (profile: CompanyProfile, symbol: string, nextEarnings: string | null): ProfileRow[] => {
  const { currency } = profile
  const rows: [string, string | null][] = [
    ['Market cap', profile.marketCap === null ? null : amount(profile.marketCap, currency)],
    ['Total assets', profile.totalAssets === null ? null : amount(profile.totalAssets, currency)],
    [
      'P/E',
      joined([
        profile.trailingPE === null ? null : twoDecimals(profile.trailingPE),
        profile.forwardPE === null ? null : `forward ${twoDecimals(profile.forwardPE)}`,
      ]),
    ],
    ['Dividend yield', profile.dividendYield === null ? null : `${twoDecimals(profile.dividendYield * 100)}%`],
    [
      '52-week range',
      profile.low52 === null || profile.high52 === null ? null : `${formatPrice(profile.low52, symbol)} – ${formatPrice(profile.high52, symbol)}`,
    ],
    ['Sector', joined([profile.sector, profile.industry])],
    ['Category', profile.category],
    ['Next earnings', nextEarnings],
    ['Beta', profile.beta === null ? null : twoDecimals(profile.beta)],
    ['Employees', profile.employees === null ? null : profile.employees.toLocaleString('en-US')],
    ['Country', profile.country],
  ]
  return rows.flatMap(([label, value]) => (value === null ? [] : [{ label, value }]))
}
