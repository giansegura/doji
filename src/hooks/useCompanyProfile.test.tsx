import { renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { CompanyProfile } from '../../shared/types'
import { useCompanyProfile } from './useCompanyProfile'

const sheet = { name: 'The Coca-Cola Company' } as CompanyProfile

test('Should ask for the sheet only while the panel is open, and say it is loading meanwhile', async () => {
  const asked: string[] = []
  const fetchProfile = async (symbol: string) => {
    asked.push(symbol)
    return sheet
  }
  const { result, rerender } = renderHook(({ open }) => useCompanyProfile('KO', open, fetchProfile), { initialProps: { open: false } })
  expect(result.current).toBeUndefined()
  expect(asked).toEqual([])
  rerender({ open: true })
  await waitFor(() => expect(result.current).toBe(sheet))
  expect(asked).toEqual(['KO'])
})

test('Should say there is no sheet when the server has none', async () => {
  const fetchProfile = async () => {
    throw Object.assign(new Error('not_found'), { code: 'not_found' })
  }
  const { result } = renderHook(() => useCompanyProfile('ZZZZ', true, fetchProfile))
  await waitFor(() => expect(result.current).toBeNull())
})
