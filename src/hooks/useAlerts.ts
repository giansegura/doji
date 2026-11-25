import { useCallback, useEffect, useRef, useState } from 'react'
import { displaySymbol } from '../../shared/symbols'
import type { AlertEvent } from '../../shared/types'
import { formatPrice } from '../chart/format'

export type FiredNotice = { id: string; text: string; time: string }

export type OpenAlerts = (onAlerts: (alerts: AlertEvent[]) => void) => () => void

type AlertsArgs = {
  notify?: (title: string, body: string) => void
  openAlerts?: OpenAlerts
}

const ALERTS_URL = '/api/alerts/stream'

const twoDigits = (value: number): string => String(value).padStart(2, '0')

const clockOf = (date: Date): string => `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`

const isAlert = (value: unknown): value is AlertEvent => {
  const alert = value as Partial<AlertEvent> | null
  return (
    typeof alert === 'object' &&
    alert !== null &&
    typeof alert.id === 'string' &&
    typeof alert.symbol === 'string' &&
    typeof alert.level === 'number' &&
    typeof alert.price === 'number' &&
    (alert.direction === 'up' || alert.direction === 'down') &&
    typeof alert.at === 'string'
  )
}

export const openAlertStream: OpenAlerts = (onAlerts) => {
  if (typeof EventSource === 'undefined') return () => undefined
  const source = new EventSource(ALERTS_URL)
  source.onmessage = (event: MessageEvent<string>) => {
    try {
      const parsed: unknown = JSON.parse(event.data)
      if (Array.isArray(parsed)) onAlerts(parsed.filter(isAlert))
    } catch {
      return
    }
  }
  return () => source.close()
}

export const notifyDesktop = (title: string, body: string): void => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {
    return
  }
}

export const askToNotify = (): void => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
  Notification.requestPermission().catch(() => undefined)
}

export const useAlerts = ({ notify = notifyDesktop, openAlerts = openAlertStream }: AlertsArgs = {}) => {
  const [fired, setFired] = useState<FiredNotice[]>([])
  const latest = useRef({ notify, openAlerts })
  const seen = useRef(new Set<string>())

  useEffect(() => {
    latest.current = { notify, openAlerts }
  })

  useEffect(() => {
    const announce = (title: string, body: string): void => {
      try {
        latest.current.notify(title, body)
      } catch {
        return
      }
    }
    return latest.current.openAlerts((alerts) => {
      const fresh = alerts.filter((alert) => !seen.current.has(alert.id))
      fresh.forEach((alert) => seen.current.add(alert.id))
      const notices = fresh.map((alert): FiredNotice => {
        const level = formatPrice(alert.level, alert.symbol)
        const shown = displaySymbol(alert.symbol)
        const now = formatPrice(alert.price, alert.symbol)
        if (alert.label) {
          announce(`${shown}: ${alert.label}`, `Going ${alert.direction}, now at ${now}`)
          return { id: alert.id, text: `${shown}: ${alert.label}, going ${alert.direction}`, time: clockOf(new Date(alert.at)) }
        }
        const reading = `${alert.direction === 'up' ? 'Up' : 'Down'} through ${level}, now at ${formatPrice(alert.price, alert.symbol)}`
        announce(`${shown} crossed ${level}`, alert.text ? `${reading} · ${alert.text}` : reading)
        return { id: alert.id, text: `${shown} crossed ${level} going ${alert.direction}`, time: clockOf(new Date(alert.at)) }
      })
      if (notices.length > 0) setFired((previous) => [...previous, ...notices])
    })
  }, [])

  const dismiss = useCallback((id: string) => setFired((previous) => previous.filter((notice) => notice.id !== id)), [])

  return { fired, dismiss }
}
