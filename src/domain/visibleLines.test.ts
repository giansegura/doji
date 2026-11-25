import { expect, test } from 'vitest'
import type { Drawing } from '../../shared/types'
import { mergeShown, visibleLines } from './visibleLines'

const base = { pane: 'price' as const, timeframe: 'D' as const, color: '#fff', width: 1, pricedAt: '2020-01-01', kind: 'hline' as const }
const shown: Drawing = { ...base, id: 's', value: 100 }
const hidden: Drawing = { ...base, id: 'h', value: 90, hidden: true }
const euros: Drawing = { ...base, id: 'e', value: 80, currency: 'EUR' }

test('Should show the drawings of the currency on screen that are not hidden, and none when all are hidden', () => {
  expect(visibleLines([shown, hidden, euros], 'original', false)).toEqual([shown])
  expect(visibleLines([shown, hidden, euros], 'EUR', false)).toEqual([euros])
  expect(visibleLines([shown, hidden, euros], 'original', true)).toEqual([])
})

test('Should put back what changed on screen in its place, keep what was not shown and add the new ones at the end', () => {
  const moved: Drawing = { ...shown, value: 105 }
  const fresh: Drawing = { ...base, id: 'n', value: 70 }
  expect(mergeShown([shown, hidden, euros], [shown], [moved, fresh], 'original')).toEqual([moved, hidden, euros, fresh])
  expect(mergeShown([shown, hidden, euros], [shown], [], 'original')).toEqual([hidden, euros])
  expect(mergeShown([shown, euros], [euros], [euros, fresh], 'EUR')).toEqual([shown, euros, { ...fresh, currency: 'EUR' }])
})
