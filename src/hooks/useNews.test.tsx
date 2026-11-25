import { renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { NewsItem } from '../../shared/types'
import { useNews } from './useNews'

const headline: NewsItem = { id: 'n1', title: 'T', publisher: 'P', time: 1, url: 'https://example.com' }

test('Should ask for the headlines only while the panel is open', async () => {
  const asked: string[] = []
  const fetchNews = async (symbol: string) => {
    asked.push(symbol)
    return [headline]
  }
  const { result, rerender } = renderHook(({ open }) => useNews('KO', open, fetchNews), { initialProps: { open: false } })
  expect(result.current).toBeUndefined()
  rerender({ open: true })
  await waitFor(() => expect(result.current).toEqual([headline]))
  expect(asked).toEqual(['KO'])
})

test('Should say the headlines could not be read when the server fails', async () => {
  const fetchNews = async () => {
    throw new Error('unavailable')
  }
  const { result } = renderHook(() => useNews('KO', true, fetchNews))
  await waitFor(() => expect(result.current).toBeNull())
})
