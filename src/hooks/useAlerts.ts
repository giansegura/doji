import { useCallback, useEffect, useRef, useState } from 'react'
import type { Drawing, Quote } from '../../shared/types'
import { formatPrice } from '../chart/format'
import { type FiredAlert, createAlertWatcher, latestPrice } from '../domain/alerts'
import type { Action } from '../state/appReducer'

export type FiredNotice = { id: string; text: string; time: string }

type AlertsArgs = {
  lines: Record<string, Drawing[]>
  quotes: Record<string, Quote>
  dispatch: (action: Action) => void
  notify?: (title: string, body: string) => void
  now?: () => Date
}

const twoDigits = (value: number): string => String(value).padStart(2, '0')

const dayOf = (date: Date): string => `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`

const clockOf = (date: Date): string => `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`

const disarmed = (drawings: Drawing[], ids: string[]): Drawing[] =>
  drawings.map((drawing) => {
    if (!ids.includes(drawing.id) || drawing.kind === 'channel' || drawing.kind === 'rect') return drawing
    const { alert: _alert, ...quiet } = drawing
    return quiet
  })

export const notifyDesktop = (title: string, body: string): void => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  new Notification(title, { body })
}

export const askToNotify = (): void => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
  Notification.requestPermission().catch(() => undefined)
}

export const useAlerts = ({ lines, quotes, dispatch, notify = notifyDesktop, now = () => new Date() }: AlertsArgs) => {
  const [watcher] = useState(createAlertWatcher)
  const [fired, setFired] = useState<FiredNotice[]>([])
  const latest = useRef({ lines, dispatch, notify, now })
  const counter = useRef(0)

  useEffect(() => {
    latest.current = { lines, dispatch, notify, now }
  })

  useEffect(() => {
    const current = latest.current
    const moment = current.now()
    const prices = Object.fromEntries(Object.values(quotes).map((quote) => [quote.symbol, latestPrice(quote)]))
    const hits = watcher.check(current.lines, prices, dayOf(moment))
    if (hits.length === 0) return
    const describe = (hit: FiredAlert): FiredNotice => {
      counter.current += 1
      const level = formatPrice(hit.level)
      current.notify(
        `${hit.symbol} crossed ${level}`,
        `${hit.direction === 'up' ? 'Up' : 'Down'} through ${level}, now at ${formatPrice(hit.price)}`,
      )
      return {
        id: `${hit.symbol}:${hit.drawingId}:${counter.current}`,
        text: `${hit.symbol} crossed ${level} going ${hit.direction}`,
        time: clockOf(moment),
      }
    }
    const notices = hits.map(describe)
    setFired((previous) => [...previous, ...notices])
    ;[...new Set(hits.map((hit) => hit.symbol))].forEach((symbol) => {
      const ids = hits.filter((hit) => hit.symbol === symbol).map((hit) => hit.drawingId)
      current.dispatch({ type: 'setLines', symbol, lines: disarmed(current.lines[symbol] ?? [], ids) })
    })
  }, [watcher, quotes])

  const dismiss = useCallback((id: string) => setFired((previous) => previous.filter((notice) => notice.id !== id)), [])

  return { fired, dismiss }
}
