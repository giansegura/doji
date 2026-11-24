import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { SymbolInfo } from '../../../shared/types'
import { renderWithTheme } from '../../test/render'
import { SymbolSearch } from '.'

const apple: SymbolInfo = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }
const hospitality: SymbolInfo = { symbol: 'APLE', name: 'Apple Hospitality REIT, Inc.', exchange: 'NYSE' }
const applied: SymbolInfo = { symbol: 'AMAT', name: 'Applied Materials, Inc.', exchange: 'NASDAQ' }

const setup = (search: (query: string) => Promise<SymbolInfo[]>) => {
  const handlers = { onPick: vi.fn(), onClose: vi.fn() }
  renderWithTheme(<SymbolSearch search={search} {...handlers} />)
  return { handlers, user: userEvent.setup(), input: screen.getByPlaceholderText('Search symbol or company') }
}

test('Should focus the field when it opens', () => {
  const { input } = setup(async () => [])
  expect(document.activeElement).toBe(input)
})

test('Should search once after the typing pause and list results', async () => {
  const search = vi.fn(async () => [apple, hospitality])
  const { user, input } = setup(search)
  await user.type(input, 'app')
  expect(await screen.findByText('Apple Inc.')).toBeTruthy()
  expect(screen.getByText('APLE')).toBeTruthy()
  expect(screen.getAllByText('NASDAQ')).toHaveLength(1)
  expect(search).toHaveBeenCalledTimes(1)
  expect(search).toHaveBeenCalledWith('app')
})

test('Should pick a result on click', async () => {
  const { handlers, user, input } = setup(async () => [apple, hospitality])
  await user.type(input, 'app')
  await user.click(await screen.findByRole('option', { name: /APLE/ }))
  expect(handlers.onPick).toHaveBeenCalledWith(hospitality)
})

test('Should pick the first result with Enter', async () => {
  const { handlers, user, input } = setup(async () => [apple, hospitality])
  await user.type(input, 'app')
  await screen.findByText('Apple Inc.')
  await user.keyboard('{Enter}')
  expect(handlers.onPick).toHaveBeenCalledWith(apple)
})

test('Should move the highlight with the arrows and pick it with Enter', async () => {
  const { handlers, user, input } = setup(async () => [apple, hospitality])
  await user.type(input, 'app')
  await screen.findByText('Apple Inc.')
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('option', { name: /APLE/ }).getAttribute('aria-selected')).toBe('true')
  await user.keyboard('{ArrowDown}{ArrowUp}{ArrowDown}{Enter}')
  expect(handlers.onPick).toHaveBeenCalledWith(hospitality)
})

test('Should not pick anything with Enter before there are results', async () => {
  const { handlers, user, input } = setup(async () => [])
  await user.type(input, '{Enter}')
  expect(handlers.onPick).not.toHaveBeenCalled()
})

test('Should close on Escape', async () => {
  const { handlers, user } = setup(async () => [])
  await user.keyboard('{Escape}')
  expect(handlers.onClose).toHaveBeenCalledTimes(1)
})

test('Should close when clicking outside the dialog', async () => {
  const { handlers, user } = setup(async () => [])
  await user.click(screen.getByTestId('search-backdrop'))
  expect(handlers.onClose).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('dialog'))
  expect(handlers.onClose).toHaveBeenCalledTimes(1)
})

test('Should say when there are no results', async () => {
  const { user, input } = setup(async () => [])
  await user.type(input, 'zzzz')
  expect(await screen.findByText('No results')).toBeTruthy()
})

test('Should say when the search fails', async () => {
  const { user, input } = setup(() => Promise.reject(new Error('sin red')))
  await user.type(input, 'app')
  expect(await screen.findByText('Search failed')).toBeTruthy()
})

test('Should not search for blank text', async () => {
  const search = vi.fn(async () => [apple])
  const { user, input } = setup(search)
  await user.type(input, '   ')
  await act(async () => new Promise((done) => setTimeout(done, 350)))
  expect(search).not.toHaveBeenCalled()
  expect(screen.getByText('Type a ticker or a company name')).toBeTruthy()
})

test('Should ignore a slow response to an older query', async () => {
  let releaseSlow: (results: SymbolInfo[]) => void = () => undefined
  const slow = new Promise<SymbolInfo[]>((resolve) => {
    releaseSlow = resolve
  })
  const search = vi.fn((query: string) => (query === 'ap' ? slow : Promise.resolve([apple])))
  const { user, input } = setup(search)
  await user.type(input, 'ap')
  await waitFor(() => expect(search).toHaveBeenCalledWith('ap'))
  await user.type(input, 'ple')
  expect(await screen.findByText('Apple Inc.')).toBeTruthy()
  await act(async () => releaseSlow([applied]))
  expect(screen.queryByText('Applied Materials, Inc.')).toBeNull()
  expect(screen.getByText('Apple Inc.')).toBeTruthy()
})

const deferred = () => {
  let release: (results: SymbolInfo[]) => void = () => undefined
  const promise = new Promise<SymbolInfo[]>((resolve) => {
    release = resolve
  })
  return { promise, release: (results: SymbolInfo[]) => release(results) }
}

test('Should not pick from the previous results while a new search is on its way', async () => {
  const pending = deferred()
  const search = vi.fn((query: string) => (query === 'ap' ? Promise.resolve([applied]) : pending.promise))
  const { handlers, user, input } = setup(search)
  await user.type(input, 'ap')
  await screen.findByText('Applied Materials, Inc.')
  await user.type(input, 'ple{Enter}')
  expect(handlers.onPick).not.toHaveBeenCalled()
})

test('Should pick the first new result when Enter came before the results', async () => {
  const pending = deferred()
  const search = vi.fn((query: string) => (query === 'ap' ? Promise.resolve([applied]) : pending.promise))
  const { handlers, user, input } = setup(search)
  await user.type(input, 'ap')
  await screen.findByText('Applied Materials, Inc.')
  await user.type(input, 'ple{Enter}')
  await waitFor(() => expect(search).toHaveBeenCalledWith('apple'))
  await act(async () => pending.release([apple, hospitality]))
  expect(handlers.onPick).toHaveBeenCalledTimes(1)
  expect(handlers.onPick).toHaveBeenCalledWith(apple)
})

test('Should forget an early Enter when the text changes', async () => {
  const search = vi.fn(async () => [apple])
  const { handlers, user, input } = setup(search)
  await user.type(input, 'ap{Enter}p')
  await screen.findByText('Apple Inc.')
  expect(search).toHaveBeenCalledTimes(1)
  expect(search).toHaveBeenCalledWith('app')
  expect(handlers.onPick).not.toHaveBeenCalled()
})

test('Should forget an early Enter when the search finds nothing', async () => {
  const search = vi.fn(async (query: string) => (query === 'zz' ? [] : [apple]))
  const { handlers, user, input } = setup(search)
  await user.type(input, 'zz{Enter}')
  await screen.findByText('No results')
  await user.clear(input)
  await user.type(input, 'app')
  await screen.findByText('Apple Inc.')
  expect(handlers.onPick).not.toHaveBeenCalled()
})
