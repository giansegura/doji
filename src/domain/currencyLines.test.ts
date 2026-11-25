import { expect, test } from 'vitest'
import type { Drawing } from '../../shared/types'
import { linesIn, mergeLinesIn } from './currencyLines'

const base = { pane: 'price' as const, timeframe: 'D' as const, color: '#fff', width: 1, pricedAt: '2020-01-01', kind: 'hline' as const }
const dollars: Drawing = { ...base, id: 'd', value: 100 }
const euros: Drawing = { ...base, id: 'e', value: 90, currency: 'EUR' }

test('Should show only the drawings made in the currency on screen', () => {
  expect(linesIn([dollars, euros], 'original')).toEqual([dollars])
  expect(linesIn([dollars, euros], 'EUR')).toEqual([euros])
})

test('Should keep the drawings of the other currency when the ones on screen change, and mark new ones with the currency on screen', () => {
  const fresh: Drawing = { ...base, id: 'n', value: 95 }
  expect(mergeLinesIn([dollars, euros], [euros, fresh], 'EUR')).toEqual([dollars, euros, { ...fresh, currency: 'EUR' }])
  expect(mergeLinesIn([dollars, euros], [], 'original')).toEqual([euros])
})
