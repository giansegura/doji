import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Quote, SymbolInfo } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { Watchlist } from '.'

const items: SymbolInfo[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'KO', name: 'The Coca-Cola Company', exchange: 'NYSE' },
]

const quotes: Record<string, Quote> = {
  AAPL: { symbol: 'AAPL', price: 229.35, change: 2.7, changePercent: 1.19 },
  MSFT: { symbol: 'MSFT', price: 431.2, change: -1.72, changePercent: -0.4 },
}

const setup = (over: { items?: SymbolInfo[]; quotes?: Record<string, Quote> } = {}) => {
  const handlers = { onSelect: vi.fn(), onRemove: vi.fn(), onMove: vi.fn(), onAdd: vi.fn() }
  renderWithTheme(
    <Watchlist items={over.items ?? items} quotes={over.quotes ?? quotes} activeSymbol="AAPL" {...handlers} />,
  )
  return { handlers, user: userEvent.setup() }
}

const carrier = () => {
  const carried: Record<string, string> = {}
  const dataTransfer = {
    effectAllowed: 'uninitialized',
    setData: (format: string, value: string) => {
      carried[format] = value
    },
  }
  return { carried, dataTransfer }
}

const row = (symbol: string): HTMLElement =>
  screen.getByRole('button', { name: (name) => name.startsWith(symbol) && !name.startsWith('Quitar') })

test('Should show the price and the percent change with sign', () => {
  setup()
  const apple = within(row('AAPL'))
  expect(apple.getByText('229.35')).toBeTruthy()
  expect(apple.getByText('+1.19%')).toBeTruthy()
  expect(within(row('MSFT')).getByText('−0.40%')).toBeTruthy()
})

test('Should not show the absolute change', () => {
  setup()
  expect(within(row('AAPL')).queryByText('+2.70')).toBeNull()
  expect(within(row('MSFT')).queryByText('−1.72')).toBeNull()
  expect(screen.queryByText('Cambio')).toBeNull()
  expect(screen.getByText('Cambio %')).toBeTruthy()
})

test('Should show the logo of each company before its ticker', () => {
  setup()
  const sources = screen.getAllByRole('listitem').map((item) => item.querySelector('img')?.getAttribute('src'))
  expect(sources).toEqual(['/api/logo?symbol=AAPL', '/api/logo?symbol=MSFT', '/api/logo?symbol=KO'])
})

test('Should show a dash while a quote is missing', () => {
  setup()
  expect(within(row('KO')).getAllByText('—')).toHaveLength(2)
})

test('Should mark the active symbol', () => {
  setup()
  expect(row('AAPL').getAttribute('aria-current')).toBe('true')
  expect(row('MSFT').getAttribute('aria-current')).toBe(null)
})

test('Should select a symbol on click', async () => {
  const { handlers, user } = setup()
  await user.click(row('MSFT'))
  expect(handlers.onSelect).toHaveBeenCalledWith('MSFT')
})

test('Should remove without selecting', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Quitar MSFT' }))
  expect(handlers.onRemove).toHaveBeenCalledWith('MSFT')
  expect(handlers.onSelect).not.toHaveBeenCalled()
})

test('Should ask to add a symbol', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Añadir símbolo' }))
  expect(handlers.onAdd).toHaveBeenCalledTimes(1)
})

test('Should report a move when a row is dropped on another', () => {
  const { handlers } = setup()
  const rows = screen.getAllByRole('listitem')
  fireEvent.dragStart(rows[0], carrier())
  fireEvent.dragOver(rows[2])
  fireEvent.drop(rows[2])
  expect(handlers.onMove).toHaveBeenCalledWith(0, 2)
})

test('Should not report a move when a row is dropped on itself', () => {
  const { handlers } = setup()
  const rows = screen.getAllByRole('listitem')
  fireEvent.dragStart(rows[1], carrier())
  fireEvent.drop(rows[1])
  expect(handlers.onMove).not.toHaveBeenCalled()
})

test('Should invite to add symbols when the list is empty', () => {
  setup({ items: [] })
  expect(screen.getByText('La lista está vacía')).toBeTruthy()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('Should carry the symbol of the row being dragged', () => {
  setup()
  const { carried, dataTransfer } = carrier()
  fireEvent.dragStart(screen.getAllByRole('listitem')[1], { dataTransfer })
  expect(carried).toEqual({ 'application/x-doji-symbol': 'MSFT' })
  expect(dataTransfer.effectAllowed).toBe('move')
})

test('Should take the drop for itself', () => {
  setup()
  const rows = screen.getAllByRole('listitem')
  fireEvent.dragStart(rows[0], carrier())
  expect(fireEvent.drop(rows[2])).toBe(false)
})
