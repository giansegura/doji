import { expect, test } from 'vitest'
import type { ListItem } from '../../shared/types'
import { onlyFlagged } from './flags'

const item = (symbol: string): ListItem => ({ symbol, name: symbol, exchange: 'NYSE' })
const section = (id: string): ListItem => ({ kind: 'section', id, title: id })

test('Should keep only the flagged symbols and the sections that still have one', () => {
  const items = [section('A'), item('KO'), item('PEP'), section('B'), item('MSFT'), section('C'), item('NVDA')]
  const kept = onlyFlagged(items, { PEP: 'red', NVDA: 'green' })
  expect(kept.map((entry) => ('kind' in entry ? `[${entry.title}]` : entry.symbol))).toEqual(['[A]', 'PEP', '[C]', 'NVDA'])
})

test('Should keep the flagged symbols that come before any section', () => {
  expect(onlyFlagged([item('KO'), item('PEP')], { KO: 'blue' })).toEqual([item('KO')])
})
