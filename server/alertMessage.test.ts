import { expect, test } from 'vitest'
import type { AlertEvent } from '../shared/types'
import { alertMessage } from './alertMessage'

const alert = (over: Partial<AlertEvent> = {}): AlertEvent => ({
  id: 'a1',
  symbol: 'KO',
  level: 60,
  price: 60.237,
  direction: 'up',
  at: '2026-11-24T15:00:00.000Z',
  text: null,
  ...over,
})

test('Should tell which symbol crossed which level, which way and where it is now', () => {
  expect(alertMessage(alert())).toBe('🔔 KO crossed 60.00 going up, now at 60.24')
})

test('Should add the text of the line and use the decimals of forex', () => {
  expect(alertMessage(alert({ symbol: 'EUR=X', level: 0.91, price: 0.90873, direction: 'down', text: 'Soporte semanal' }))).toBe(
    '🔔 USDEUR crossed 0.9100 going down, now at 0.9087 · Soporte semanal',
  )
})

test('Should say what an indicator alert watched instead of a level', () => {
  expect(alertMessage(alert({ level: 30, price: 58.1, direction: 'down', label: 'RSI 14 crosses 30' }))).toBe('🔔 KO: RSI 14 crosses 30, going down, now at 58.10')
})
