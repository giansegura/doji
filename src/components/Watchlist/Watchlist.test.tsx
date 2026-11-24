import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { ListItem, Quote, SymbolInfo, WatchlistSort } from '../../../shared/types'
import { ThemeProvider } from 'styled-components'
import { renderWithTheme } from '../../test/render'
import { themes } from '../../theme/tokens'
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

const setup = (
  over: { items?: ListItem[]; quotes?: Record<string, Quote>; sort?: WatchlistSort | null; earningsSoon?: Record<string, number> } = {},
) => {
  const handlers = {
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    onAdd: vi.fn(),
    onAddSection: vi.fn(),
    onRenameSection: vi.fn(),
    onRemoveSection: vi.fn(),
    onSort: vi.fn(),
  }
  renderWithTheme(
    <Watchlist
      items={over.items ?? items}
      quotes={over.quotes ?? quotes}
      activeSymbol="AAPL"
      sort={over.sort ?? null}
      earningsSoon={over.earningsSoon}
      {...handlers}
    />,
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
  screen.getByRole('button', { name: (name) => name.startsWith(symbol) && !name.startsWith('Remove') })

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
  expect(screen.getByText('Chg%')).toBeTruthy()
})

test('Should show the logo of each company before its ticker', () => {
  setup()
  const sources = screen.getAllByRole('listitem').map((item) => item.querySelector('img')?.getAttribute('src'))
  expect(sources).toEqual(['/api/logo?symbol=AAPL', '/api/logo?symbol=MSFT', '/api/logo?symbol=KO'])
})

test('Should show a dash while a quote is missing', () => {
  setup()
  expect(within(row('KO')).getAllByText('—')).toHaveLength(3)
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
  await user.click(screen.getByRole('button', { name: 'Remove MSFT' }))
  expect(handlers.onRemove).toHaveBeenCalledWith('MSFT')
  expect(handlers.onSelect).not.toHaveBeenCalled()
})

test('Should ask to add a symbol', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Add symbol' }))
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
  expect(screen.getByText('This watchlist is empty')).toBeTruthy()
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

const withExtended: Record<string, Quote> = {
  AAPL: { ...quotes.AAPL, extended: { session: 'pre', price: 231.1, changePercent: 0.7631 } },
  MSFT: { ...quotes.MSFT, extended: { session: 'post', price: 429.05, changePercent: -0.4986 } },
  KO: { symbol: 'KO', price: 62.1, change: 0.2, changePercent: 0.32, extended: null },
}

test('Should have a column for the change outside regular hours', () => {
  setup()
  expect(screen.getByText('Ext')).toBeTruthy()
  expect(screen.queryByText('Pre/Post')).toBeNull()
})

test('Should show only the percent change of the pre-market price and keep the price at hand', () => {
  setup({ quotes: withExtended })
  const cell = within(row('AAPL')).getByTitle('Pre-market: 231.10 (+0.76%)')
  expect(cell.textContent).toBe('+0.76%')
  expect(within(cell).queryByRole('img')).toBeNull()
})

test('Should show only the percent change of the after-hours price and keep the price at hand', () => {
  setup({ quotes: withExtended })
  const cell = within(row('MSFT')).getByTitle('Post-market: 429.05 (−0.50%)')
  expect(cell.textContent).toBe('−0.50%')
})

test('Should show a dash for a symbol with no price outside regular hours', () => {
  setup({ quotes: withExtended })
  expect(within(row('KO')).getAllByText('—')).toHaveLength(1)
  expect(within(row('KO')).getByText('62.10')).toBeTruthy()
})

test('Should mark next to the ticker whether the symbol is in pre-market or after hours', () => {
  setup({ quotes: withExtended })
  expect(within(row('AAPL')).getByRole('img', { name: 'Pre-market' })).toBeTruthy()
  expect(within(row('MSFT')).getByRole('img', { name: 'Post-market' })).toBeTruthy()
  expect(within(row('KO')).queryByRole('img', { name: /mercado/ })).toBeNull()
})

const sectioned: ListItem[] = [
  { kind: 'section', id: 's1', title: 'En cartera' },
  items[0],
  { kind: 'section', id: 's2', title: 'Vigilando' },
  items[1],
]

test('Should show the sections of the list between its symbols, in order', () => {
  setup({ items: sectioned })
  const rows = screen.getAllByRole('listitem').map((item) => item.textContent ?? '')
  expect(rows[0]).toContain('En cartera')
  expect(rows[1]).toContain('AAPL')
  expect(rows[2]).toContain('Vigilando')
  expect(rows[3]).toContain('MSFT')
})

test('Should not treat a section as a symbol', async () => {
  const { handlers, user } = setup({ items: sectioned })
  await user.click(screen.getByText('Vigilando'))
  expect(handlers.onSelect).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Remove Vigilando' })).toBeNull()
})

test('Should remove a section', async () => {
  const { handlers, user } = setup({ items: sectioned })
  await user.click(screen.getByRole('button', { name: 'Remove section Vigilando' }))
  expect(handlers.onRemoveSection).toHaveBeenCalledWith('s2')
})

test('Should rename a section in place', async () => {
  const { handlers, user } = setup({ items: sectioned })
  await user.click(screen.getByRole('button', { name: 'Rename section Vigilando' }))
  const field = screen.getByRole('textbox', { name: 'Section name' })
  expect((field as HTMLInputElement).value).toBe('Vigilando')
  await user.clear(field)
  await user.type(field, 'Para vender{Enter}')
  expect(handlers.onRenameSection).toHaveBeenCalledWith('s2', 'Para vender')
  expect(screen.queryByRole('textbox', { name: 'Section name' })).toBeNull()
})

test('Should leave a section as it was when renaming is cancelled', async () => {
  const { handlers, user } = setup({ items: sectioned })
  await user.click(screen.getByRole('button', { name: 'Rename section Vigilando' }))
  await user.type(screen.getByRole('textbox', { name: 'Section name' }), 'x{Escape}')
  expect(handlers.onRenameSection).not.toHaveBeenCalled()
  expect(screen.getByText('Vigilando')).toBeTruthy()
})

test('Should ask for the name of a new section and add it', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Add section' }))
  await user.type(screen.getByRole('textbox', { name: 'New section name' }), 'En cartera{Enter}')
  expect(handlers.onAddSection).toHaveBeenCalledWith('En cartera')
  expect(screen.queryByRole('textbox', { name: 'New section name' })).toBeNull()
})

test('Should not add a section without a name', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Add section' }))
  await user.type(screen.getByRole('textbox', { name: 'New section name' }), '   {Enter}')
  expect(handlers.onAddSection).not.toHaveBeenCalled()
})

test('Should report a move when a section is dropped on another row', () => {
  const { handlers } = setup({ items: sectioned })
  const rows = screen.getAllByRole('listitem')
  const { dataTransfer } = carrier()
  fireEvent.dragStart(rows[2], { dataTransfer })
  fireEvent.drop(rows[0], { dataTransfer })
  expect(handlers.onMove).toHaveBeenCalledWith(2, 0)
})

test('Should rename a section whose id looks like the mark of a new one', async () => {
  const { user } = setup({ items: [{ kind: 'section', id: 'new', title: 'Rara' }] })
  await user.click(screen.getByRole('button', { name: 'Rename section Rara' }))
  expect(screen.getAllByRole('textbox')).toHaveLength(1)
  expect(screen.getByRole('textbox', { name: 'Section name' })).toBeTruthy()
})

test('Should not close the section field on the Enter or Escape that belong to composing a character', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Add section' }))
  const field = screen.getByRole('textbox', { name: 'New section name' })
  await user.type(field, 'En')
  fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
  fireEvent.keyDown(field, { key: 'Escape', isComposing: true })
  expect(handlers.onAddSection).not.toHaveBeenCalled()
  expect(screen.getByRole('textbox', { name: 'New section name' })).toBeTruthy()
})

test('Should show a forex pair like TradingView with the decimals of forex', () => {
  setup({
    items: [{ symbol: 'EURUSD=X', name: 'EUR/USD', exchange: 'Forex' }],
    quotes: { 'EURUSD=X': { symbol: 'EURUSD=X', price: 1.096731, change: 0.0061, changePercent: 0.559, extended: null } },
  })
  const pair = row('EURUSD')
  expect(within(pair).getByText('EURUSD')).toBeTruthy()
  expect(within(pair).getByText('1.0967')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Remove EURUSD' })).toBeTruthy()
})

test('Should ask to sort by the column whose header is clicked', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Sort by Chg%' }))
  await user.click(screen.getByRole('button', { name: 'Sort by Symbol' }))
  await user.click(screen.getByRole('button', { name: 'Sort by Last' }))
  await user.click(screen.getByRole('button', { name: 'Sort by Ext' }))
  expect(handlers.onSort.mock.calls.map(([column]) => column)).toEqual(['change', 'symbol', 'last', 'ext'])
})

test('Should mark the sorted column with an arrow that shows the direction', () => {
  setup({ sort: { column: 'change', direction: 'desc' } })
  expect(screen.getByRole('button', { name: 'Sort by Chg%, highest first' }).textContent).toBe('Chg% ▼')
  expect(screen.getByRole('button', { name: 'Sort by Symbol' }).textContent).toBe('Symbol')
})

test('Should point the arrow up when the order is ascending', () => {
  setup({ sort: { column: 'symbol', direction: 'asc' } })
  expect(screen.getByRole('button', { name: 'Sort by Symbol, A to Z' }).textContent).toBe('Symbol ▲')
})

test('Should not let the rows be dragged while the list is sorted', () => {
  setup({ sort: { column: 'change', direction: 'desc' } })
  expect(screen.getAllByRole('listitem').every((row) => row.getAttribute('draggable') === 'false')).toBe(true)
})

test('Should let the rows be dragged in the order of the user', () => {
  setup()
  expect(screen.getAllByRole('listitem').every((row) => row.getAttribute('draggable') === 'true')).toBe(true)
})

test('Should space the symbols every thirty pixels with a divider between them, like TradingView', () => {
  setup()
  const [first] = screen.getAllByRole('listitem')
  const button = within(first).getAllByRole('button')[0]
  const item = getComputedStyle(first)
  expect(parseFloat(getComputedStyle(button).height) + parseFloat(item.borderBottomWidth)).toBe(30)
  expect(item.borderBottomStyle).toBe('solid')
  expect(item.borderBottomColor).toBe('rgb(34, 34, 34)')
})

test('Should paint rises and falls with the green and red of TradingView', () => {
  setup()
  expect(getComputedStyle(screen.getByText('+1.19%')).color).toBe('rgb(34, 171, 148)')
  expect(getComputedStyle(screen.getByText('−0.40%')).color).toBe('rgb(242, 54, 69)')
})

test('Should name the direction of the order in the header of the sorted column', () => {
  setup({ sort: { column: 'last', direction: 'asc' } })
  expect(screen.getByRole('button', { name: 'Sort by Last, lowest first' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sort by Symbol' })).toBeTruthy()
})

test('Should drop a drag that began before the list got sorted', () => {
  const handlers = {
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    onAdd: vi.fn(),
    onAddSection: vi.fn(),
    onRenameSection: vi.fn(),
    onRemoveSection: vi.fn(),
    onSort: vi.fn(),
  }
  const view = (sort: WatchlistSort | null) => (
    <ThemeProvider theme={themes.midnight}>
      <Watchlist items={items} quotes={quotes} activeSymbol="AAPL" sort={sort} {...handlers} />
    </ThemeProvider>
  )
  const { rerender } = render(view(null))
  fireEvent.dragStart(screen.getAllByRole('listitem')[0], carrier())
  rerender(view({ column: 'change', direction: 'desc' }))
  const rows = screen.getAllByRole('listitem')
  fireEvent.dragOver(rows[2])
  fireEvent.drop(rows[2])
  expect(handlers.onMove).not.toHaveBeenCalled()
})

test('Should say that prices are live', () => {
  const noop = () => undefined
  renderWithTheme(
    <Watchlist
      items={items}
      quotes={quotes}
      activeSymbol="AAPL"
      sort={null}
      live
      onSelect={noop}
      onRemove={noop}
      onMove={noop}
      onAdd={noop}
      onAddSection={noop}
      onRenameSection={noop}
      onRemoveSection={noop}
      onSort={noop}
    />,
  )
  const mark = screen.getByRole('img', { name: 'Live prices' })
  expect(mark.getAttribute('title')).toBe('Live prices')
  expect(getComputedStyle(mark).backgroundColor).toBe('rgb(34, 171, 148)')
})

test('Should say that prices refresh every fifteen seconds when they are not live', () => {
  setup()
  const mark = screen.getByRole('img', { name: 'Prices refresh every 15 seconds' })
  expect(getComputedStyle(mark).backgroundColor).toBe('rgb(120, 123, 134)')
  expect(screen.queryByRole('img', { name: 'Live prices' })).toBeNull()
})

const listWith = (price: number) => (
  <ThemeProvider theme={themes.midnight}>
    <Watchlist
      items={items}
      quotes={{ ...quotes, AAPL: { ...quotes.AAPL, price } }}
      activeSymbol="AAPL"
      sort={null}
      onSelect={() => undefined}
      onRemove={() => undefined}
      onMove={() => undefined}
      onAdd={() => undefined}
      onAddSection={() => undefined}
      onRenameSection={() => undefined}
      onRemoveSection={() => undefined}
      onSort={() => undefined}
    />
  </ThemeProvider>
)

const flashOf = (symbol: string) => row(symbol).querySelector('[data-flash]')

const partsOf = (flash: Element | null) => [...(flash?.children ?? [])].map((part) => part.textContent)

test('Should not mark a price that has not changed since it was first shown', () => {
  const { rerender } = render(listWith(229.35))
  rerender(listWith(229.35))
  expect(flashOf('AAPL')).toBeNull()
  expect(within(row('AAPL')).getByText('229.35')).toBeTruthy()
})

test('Should mark as a rise the digits that changed when the price goes up', () => {
  const { rerender } = render(listWith(229.35))
  rerender(listWith(229.61))
  const flash = flashOf('AAPL')
  expect(flash?.getAttribute('data-flash')).toBe('up')
  expect(partsOf(flash)).toEqual(['229.', '61'])
  expect(flash?.textContent).toBe('229.61')
  expect(flashOf('MSFT')).toBeNull()
})

test('Should mark as a fall the digits that changed when the price goes down', () => {
  const { rerender } = render(listWith(229.35))
  rerender(listWith(228.9))
  const flash = flashOf('AAPL')
  expect(flash?.getAttribute('data-flash')).toBe('down')
  expect(partsOf(flash)).toEqual(['22', '8.90'])
})

test('Should start the mark again with every change of the price', () => {
  const { rerender } = render(listWith(229.35))
  rerender(listWith(229.61))
  const first = flashOf('AAPL')
  rerender(listWith(229.64))
  const second = flashOf('AAPL')
  expect(second).not.toBe(first)
  expect(partsOf(second)).toEqual(['229.6', '4'])
})

test('Should leave the mark as it is when the list is drawn again with the same price', () => {
  const { rerender } = render(listWith(229.35))
  rerender(listWith(229.61))
  const first = flashOf('AAPL')
  rerender(listWith(229.61))
  expect(flashOf('AAPL')).toBe(first)
})

test('Should warn on the row of a symbol that reports earnings within a week', () => {
  setup({ earningsSoon: { AAPL: 3, MSFT: 0 } })
  expect(screen.getByRole('img', { name: 'Earnings in 3 days' }).textContent).toBe('E 3d')
  expect(screen.getByRole('img', { name: 'Earnings today' }).textContent).toBe('E')
  expect(screen.getAllByRole('img', { name: /^Earnings/ })).toHaveLength(2)
})
