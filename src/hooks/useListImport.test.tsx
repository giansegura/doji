import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { SymbolInfo } from '../../shared/types'
import { useListImport } from './useListImport'

const apple: SymbolInfo = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }

const fileOf = (name: string, text: string) => new File([text], name, { type: 'text/plain' })

const ids = () => {
  let next = 0
  return () => `id-${(next += 1)}`
}

test('Should check the file, create the list with what was found and report what was not', async () => {
  const onCreate = vi.fn()
  const resolve = async (groups: string[][]) => groups.map(([symbol]) => (symbol === 'AAPL' ? apple : null))
  const { result } = renderHook(() => useListImport(onCreate, resolve, ids()))
  await act(() => result.current.start(fileOf('Tech.txt', '###Big,NASDAQ:AAPL,NASDAQ:ZZZZ')))
  expect(onCreate).toHaveBeenCalledWith('id-2', 'Tech', [{ kind: 'section', id: 'id-1', title: 'Big' }, apple])
  expect(result.current.progress).toEqual({ status: 'done', name: 'Tech', added: 1, notFound: ['NASDAQ:ZZZZ'] })
  act(() => result.current.close())
  expect(result.current.progress).toBeNull()
})

test('Should show how many symbols it has checked while it works', async () => {
  let answer: (found: (SymbolInfo | null)[]) => void = () => undefined
  const resolve = () => new Promise<(SymbolInfo | null)[]>((done) => (answer = done))
  const { result } = renderHook(() => useListImport(vi.fn(), resolve, ids()))
  act(() => {
    void result.current.start(fileOf('a.csv', 'AAPL\n'))
  })
  await waitFor(() => expect(result.current.progress).toEqual({ status: 'checking', name: 'a', done: 0, total: 1 }))
  await act(async () => answer([apple]))
  expect(result.current.progress).toMatchObject({ status: 'done', added: 1 })
})

test('Should not create an empty list when nothing in the file is found', async () => {
  const onCreate = vi.fn()
  const { result } = renderHook(() => useListImport(onCreate, async (groups) => groups.map(() => null), ids()))
  await act(() => result.current.start(fileOf('x.txt', 'ZZZZ,not a symbol')))
  expect(onCreate).not.toHaveBeenCalled()
  expect(result.current.progress).toEqual({ status: 'done', name: 'x', added: 0, notFound: ['ZZZZ', 'not a symbol'] })
})

test('Should say the check failed when Yahoo cannot answer', async () => {
  const onCreate = vi.fn()
  const resolve = async () => {
    throw new Error('unavailable')
  }
  const { result } = renderHook(() => useListImport(onCreate, resolve, ids()))
  await act(() => result.current.start(fileOf('x.txt', 'AAPL')))
  expect(onCreate).not.toHaveBeenCalled()
  expect(result.current.progress).toEqual({ status: 'failed', name: 'x' })
})
