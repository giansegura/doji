import { renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { SymbolMetrics } from '../../shared/symbolMetrics'
import type { WatchMetricsAnswer } from '../api/client'
import { useWatchMetrics } from './useWatchMetrics'

const metrics = (rsi: number): SymbolMetrics => ({ rsi, fromHighPercent: -1, volumeRatio: 1, level: null })

test('Should ask again soon while the server is still loading histories and then only now and then', async () => {
  const answers: WatchMetricsAnswer[] = [
    { metrics: { KO: metrics(50) }, pending: 1 },
    { metrics: { KO: metrics(50), PEP: metrics(60) }, pending: 0 },
  ]
  const asked: string[] = []
  const fetchMetrics = async (symbols: string[], withLevel: boolean) => {
    asked.push(`${symbols.join(',')}${withLevel ? ' with level' : ''}`)
    return answers[Math.min(asked.length - 1, answers.length - 1)]
  }
  const { result } = renderHook(() => useWatchMetrics(['KO', 'PEP'], true, true, fetchMetrics, { soon: 5, later: 300 }))
  await waitFor(() => expect(Object.keys(result.current)).toEqual(['KO', 'PEP']))
  expect(asked).toEqual(['KO,PEP with level', 'KO,PEP with level'])
  await waitFor(() => expect(asked).toHaveLength(3))
})

test('Should ask nothing while no column needs it or without symbols', async () => {
  const asked: string[][] = []
  const fetchMetrics = async (symbols: string[]) => {
    asked.push(symbols)
    return { metrics: {}, pending: 0 }
  }
  renderHook(() => useWatchMetrics(['KO'], false, false, fetchMetrics, { soon: 5, later: 5 }))
  renderHook(() => useWatchMetrics([], true, false, fetchMetrics, { soon: 5, later: 5 }))
  await new Promise((done) => setTimeout(done, 20))
  expect(asked).toEqual([])
})
