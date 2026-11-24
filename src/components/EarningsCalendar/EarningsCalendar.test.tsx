import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Earnings, SymbolList } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { EarningsCalendar } from '.'

const lists: SymbolList[] = [
  {
    id: 'tech',
    name: 'Tecnología',
    items: [
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
    ],
  },
  { id: 'fav', name: 'Hola', items: [{ symbol: 'KO', name: 'The Coca-Cola Company', exchange: 'NYSE' }] },
]

const earnings: Record<string, Earnings> = {
  AAPL: { past: ['2026-11-02'], next: '2026-11-26', nextIsEstimate: false, timing: { '2026-11-26': 'post' } },
  NVDA: { past: [], next: '2026-11-25', nextIsEstimate: true, timing: { '2026-11-25': 'pre' } },
  KO: { past: [], next: '2026-12-02', nextIsEstimate: false },
}

const setup = (over: { pending?: number; badge?: boolean } = {}) => {
  const handlers = { onPick: vi.fn(), onClose: vi.fn(), onBadge: vi.fn() }
  renderWithTheme(
    <EarningsCalendar
      lists={lists}
      earnings={earnings}
      pending={over.pending ?? 0}
      today="2026-11-24"
      badge={over.badge ?? false}
      {...handlers}
    />,
  )
  return { handlers, user: userEvent.setup() }
}

const day = (name: RegExp) => screen.getByRole('group', { name })

test('Should open on the current week, from Monday to Friday, with who reports each day', () => {
  setup()
  expect(screen.getByRole('dialog', { name: 'Earnings calendar' })).toBeTruthy()
  expect(screen.getByText('Nov 23 – Nov 27, 2026')).toBeTruthy()
  expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual([
    'Mon Nov 23',
    'Tue Nov 24',
    'Wed Nov 25',
    'Thu Nov 26',
    'Fri Nov 27',
  ])
  expect(within(day(/Wed Nov 25/)).getByRole('button', { name: /NVDA/ })).toBeTruthy()
  expect(within(day(/Thu Nov 26/)).getByRole('button', { name: /AAPL/ })).toBeTruthy()
})

test('Should say when a report comes before the opening or after the close and when its date is only a guess', () => {
  setup()
  expect(screen.getByRole('button', { name: 'NVDA, NVIDIA Corporation, before the opening, estimated date' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'AAPL, Apple Inc., after the close' })).toBeTruthy()
})

test('Should move to the next week and back to this one', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Next week' }))
  expect(screen.getByText('Nov 30 – Dec 4, 2026')).toBeTruthy()
  expect(within(day(/Wed Dec 2/)).getByRole('button', { name: /KO/ })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'This week' }))
  expect(screen.getByText('Nov 23 – Nov 27, 2026')).toBeTruthy()
})

test('Should show only the symbols of the chosen list', async () => {
  const { user } = setup()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'fav')
  expect(screen.queryByRole('button', { name: /AAPL/ })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Next week' }))
  expect(screen.getByRole('button', { name: /KO/ })).toBeTruthy()
})

test('Should open the chart of a symbol and close', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: /AAPL/ }))
  expect(handlers.onPick).toHaveBeenCalledWith('AAPL')
})

test('Should say how many dates are still on their way', () => {
  setup({ pending: 12 })
  expect(screen.getByRole('status').textContent).toBe('Loading earnings dates… 12 left')
})

test('Should switch the earnings warning of the watchlist on and close with Escape', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('checkbox', { name: 'Warn in the watchlist when earnings are less than a week away' }))
  expect(handlers.onBadge).toHaveBeenCalledWith(true)
  await user.keyboard('{Escape}')
  expect(handlers.onClose).toHaveBeenCalled()
})
