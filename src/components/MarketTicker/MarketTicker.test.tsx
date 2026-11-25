import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DEFAULT_TICKER } from '../../../shared/ticker'
import type { Quote } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { MarketTicker } from '.'

const quotes: Record<string, Quote> = {
  '^GSPC': { symbol: '^GSPC', price: 6021.63, change: 22.8, changePercent: 0.38 },
  'EURUSD=X': { symbol: 'EURUSD=X', price: 1.05213, change: -0.0031, changePercent: -0.29 },
  'BTC-USD': { symbol: 'BTC-USD', price: 94123.5, change: 1100, changePercent: 1.18 },
}

const setup = () => {
  const handlers = { onPick: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(), onHide: vi.fn() }
  renderWithTheme(<MarketTicker items={DEFAULT_TICKER.items} quotes={quotes} active="^GSPC" {...handlers} />)
  return { ...handlers, user: userEvent.setup() }
}

test('Should show each market with its price and the change of the day', () => {
  setup()
  const strip = screen.getByRole('region', { name: 'Market ticker' })
  const sp = within(strip).getByRole('button', { name: /^S&P 500/ })
  expect(sp.textContent).toContain('6,021.63')
  expect(sp.textContent).toContain('+0.38%')
  expect(within(strip).getByRole('button', { name: /^EUR\/USD/ }).textContent).toContain('1.0521')
  expect(within(strip).getByRole('button', { name: /^EUR\/USD/ }).textContent).toContain('−0.29%')
  expect(within(strip).getByRole('button', { name: /^VIX/ }).textContent).toContain('—')
})

test('Should mark the market whose chart is open', () => {
  setup()
  expect(screen.getByRole('button', { name: /^S&P 500/ }).getAttribute('aria-current')).toBe('true')
  expect(screen.getByRole('button', { name: /^Bitcoin/ }).getAttribute('aria-current')).toBeNull()
})

test('Should open the chart of the market clicked', async () => {
  const { onPick, user } = setup()
  await user.click(screen.getByRole('button', { name: /^Bitcoin/ }))
  expect(onPick).toHaveBeenCalledWith('BTC-USD')
})

test('Should let the symbols be removed, added or the whole ticker hidden while editing', async () => {
  const { onAdd, onRemove, onHide, user } = setup()
  expect(screen.queryByRole('button', { name: 'Remove VIX from the ticker' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Edit ticker' }))
  await user.click(screen.getByRole('button', { name: 'Remove VIX from the ticker' }))
  expect(onRemove).toHaveBeenCalledWith('^VIX')
  await user.click(screen.getByRole('button', { name: 'Add to ticker' }))
  expect(onAdd).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Hide ticker' }))
  expect(onHide).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.queryByRole('button', { name: 'Hide ticker' })).toBeNull()
})

test('Should not open a chart while editing', async () => {
  const { onPick, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Edit ticker' }))
  expect(screen.queryByRole('button', { name: /^Bitcoin/ })).toBeNull()
  expect(screen.getByText('Bitcoin')).toBeTruthy()
  expect(onPick).not.toHaveBeenCalled()
})

test('Should invite to add a symbol when the ticker is empty', async () => {
  const onAdd = vi.fn()
  renderWithTheme(<MarketTicker items={[]} quotes={{}} active="AAPL" onPick={vi.fn()} onAdd={onAdd} onRemove={vi.fn()} onHide={vi.fn()} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Add to ticker' }))
  expect(onAdd).toHaveBeenCalled()
})
