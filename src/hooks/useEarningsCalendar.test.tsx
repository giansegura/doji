import { renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { Earnings } from '../../shared/types'
import type { EarningsCalendarAnswer } from '../api/client'
import { useEarningsCalendar } from './useEarningsCalendar'

const of = (next: string): Earnings => ({ past: [], next, nextIsEstimate: false })

test('Should ask again while the server is still fetching dates and stop once it has them all', async () => {
  const answers: EarningsCalendarAnswer[] = [
    { earnings: { AAPL: of('2027-01-28') }, pending: 1 },
    { earnings: { AAPL: of('2027-01-28'), NVDA: of('2027-02-24') }, pending: 0 },
  ]
  const asked: string[][] = []
  const fetchCalendar = async (symbols: string[]) => {
    asked.push(symbols)
    return answers[Math.min(asked.length - 1, answers.length - 1)]
  }
  const { result } = renderHook(() => useEarningsCalendar(['AAPL', 'NVDA'], true, fetchCalendar, 5))
  await waitFor(() => expect(result.current.pending).toBe(0))
  expect(Object.keys(result.current.earnings)).toEqual(['AAPL', 'NVDA'])
  await new Promise((done) => setTimeout(done, 30))
  expect(asked).toHaveLength(2)
})

test('Should ask nothing while switched off or without symbols', async () => {
  const asked: string[][] = []
  const fetchCalendar = async (symbols: string[]) => {
    asked.push(symbols)
    return { earnings: {}, pending: 0 }
  }
  renderHook(() => useEarningsCalendar(['AAPL'], false, fetchCalendar, 5))
  renderHook(() => useEarningsCalendar([], true, fetchCalendar, 5))
  await new Promise((done) => setTimeout(done, 20))
  expect(asked).toEqual([])
})
