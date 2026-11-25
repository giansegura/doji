import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Drawing } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { DrawingsList } from '.'

const base = { pane: 'price' as const, timeframe: 'D' as const, color: '#fff', width: 1, pricedAt: '2020-01-01' }

const drawings: Drawing[] = [
  { ...base, id: 'h', kind: 'hline', value: 61.5, text: 'R1' },
  { ...base, id: 't', p1: { date: '2026-10-01', value: 58 }, p2: { date: '2026-11-02', value: 61 }, extendRight: false, hidden: true },
  { ...base, id: 'z', kind: 'zone', top: 60, bottom: 59 },
  { ...base, id: 'n', kind: 'note', p1: { date: '2026-11-20', value: 61 }, text: 'Earnings' },
]

const setup = (list: Drawing[] = drawings) => {
  const onChange = vi.fn()
  renderWithTheme(<DrawingsList symbol="KO" drawings={list} onChange={onChange} />)
  return { onChange, user: userEvent.setup() }
}

test('Should list each drawing with its kind, its level and its text', () => {
  setup()
  const items = screen.getAllByRole('listitem').map((item) => item.textContent)
  expect(items[0]).toContain('Horizontal line')
  expect(items[0]).toContain('61.50')
  expect(items[0]).toContain('R1')
  expect(items[1]).toContain('Trend line')
  expect(items[1]).toContain('58.00 → 61.00')
  expect(items[2]).toContain('59.00 – 60.00')
  expect(items[3]).toContain('Earnings')
})

test('Should hide and show a drawing and delete it', async () => {
  const { onChange, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Hide Horizontal line 61.50' }))
  expect(onChange).toHaveBeenLastCalledWith([{ ...drawings[0], hidden: true }, ...drawings.slice(1)])
  await user.click(screen.getByRole('button', { name: 'Show Trend line 58.00 → 61.00' }))
  const { hidden: _gone, ...shown } = drawings[1]
  expect(onChange).toHaveBeenLastCalledWith([drawings[0], shown, ...drawings.slice(2)])
  await user.click(screen.getByRole('button', { name: 'Delete Zone 59.00 – 60.00' }))
  expect(onChange).toHaveBeenLastCalledWith([drawings[0], drawings[1], drawings[3]])
})

test('Should say when the symbol has no drawings', () => {
  setup([])
  expect(screen.getByText('No drawings on KO')).toBeTruthy()
})
