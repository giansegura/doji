import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { addDays } from '../../../shared/dates'
import { displaySymbol } from '../../../shared/symbols'
import type { Earnings, EarningsTiming, SymbolList } from '../../../shared/types'
import { type CalendarEntry, calendarEntries, calendarItems, calendarWeek, shiftWeek, weekStart } from '../../domain/earningsCalendar'
import { focusedBefore, keepTabInside } from '../../domain/dialogFocus'
import { SymbolLogo } from '../SymbolLogo'
import * as Styles from './styles'

type EarningsCalendarProps = {
  lists: SymbolList[]
  earnings: Record<string, Earnings>
  pending: number
  today: string
  badge: boolean
  onBadge: (on: boolean) => void
  onPick: (symbol: string) => void
  onClose: () => void
}

const ALL_LISTS = ''
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const YEAR = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' })
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
const TIMING_WORDS: Record<EarningsTiming, string> = { pre: 'before the opening', post: 'after the close' }
const TIMING_MARKS: Record<EarningsTiming, string> = { pre: '☀', post: '☾' }

const asDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

const weekLabel = (monday: string): string => {
  const friday = asDate(addDays(monday, 4))
  return `${DAY.format(asDate(monday))} – ${DAY.format(friday)}, ${YEAR.format(friday)}`
}

const dayLabel = (date: string, weekend: boolean): string =>
  weekend ? `Weekend ${DAY.format(asDate(date))}` : `${WEEKDAY.format(asDate(date))} ${DAY.format(asDate(date))}`

const weekdayOf = (date: string): string => WEEKDAY.format(asDate(date))

const entryLabel = (entry: CalendarEntry, weekend: boolean): string =>
  [
    displaySymbol(entry.symbol),
    entry.name,
    ...(weekend ? [`${weekdayOf(entry.date)} ${DAY.format(asDate(entry.date))}`] : []),
    ...(entry.timing ? [TIMING_WORDS[entry.timing]] : []),
    ...(entry.estimate ? ['estimated date'] : []),
  ].join(', ')

export const EarningsCalendar = ({ lists, earnings, pending, today, badge, onBadge, onPick, onClose }: EarningsCalendarProps) => {
  const [monday, setMonday] = useState(() => weekStart(today))
  const [listId, setListId] = useState(ALL_LISTS)
  const dialogRef = useRef<HTMLDivElement>(null)
  const entries = useMemo(() => calendarEntries(calendarItems(lists), earnings), [lists, earnings])
  const days = calendarWeek(entries, monday, listId === ALL_LISTS ? null : listId)
  const namesOf = (entry: CalendarEntry): string =>
    entry.lists.map((id) => lists.find((list) => list.id === id)?.name ?? '').filter(Boolean).join(', ')

  useEffect(() => {
    const previous = focusedBefore()
    dialogRef.current?.focus()
    return () => previous?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
    keepTabInside(event, dialogRef.current)
  }

  const handleBackdrop = (event: MouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }

  const pick = (symbol: string) => {
    onPick(symbol)
    onClose()
  }

  return (
    <Styles.Backdrop onClick={handleBackdrop}>
      <Styles.Dialog ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Earnings calendar" onKeyDown={handleKeyDown}>
        <Styles.Header>
          <Styles.Title>Earnings</Styles.Title>
          <Styles.Nav>
            <Styles.NavButton type="button" aria-label="Previous week" title="Previous week" onClick={() => setMonday(shiftWeek(monday, -1))}>
              ‹
            </Styles.NavButton>
            <Styles.Range>{weekLabel(monday)}</Styles.Range>
            <Styles.NavButton type="button" aria-label="Next week" title="Next week" onClick={() => setMonday(shiftWeek(monday, 1))}>
              ›
            </Styles.NavButton>
            <Styles.TextButton type="button" onClick={() => setMonday(weekStart(today))}>
              This week
            </Styles.TextButton>
          </Styles.Nav>
          <Styles.Filter aria-label="Show" value={listId} onChange={(event) => setListId(event.target.value)}>
            <option value={ALL_LISTS}>All lists</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {[list.icon, list.name].filter(Boolean).join(' ')}
              </option>
            ))}
          </Styles.Filter>
          <Styles.NavButton type="button" aria-label="Close" title="Close" onClick={onClose}>
            ×
          </Styles.NavButton>
        </Styles.Header>
        {pending > 0 && <Styles.Status role="status">{`Loading earnings dates… ${pending} left`}</Styles.Status>}
        <Styles.Week $days={days.length}>
          {days.map((day, index) => (
            <Styles.Day key={day.date} role="group" aria-label={dayLabel(day.date, index >= 5)} $today={day.date === today}>
              <Styles.DayName>{dayLabel(day.date, index >= 5)}</Styles.DayName>
              {day.entries.map((entry) => (
                <Styles.Entry
                  key={`${entry.symbol}-${entry.date}`}
                  type="button"
                  aria-label={entryLabel(entry, index >= 5)}
                  title={[entry.name, namesOf(entry)].filter(Boolean).join(' · ')}
                  $past={entry.kind === 'past'}
                  onClick={() => pick(entry.symbol)}
                >
                  <SymbolLogo symbol={entry.symbol} size={16} />
                  <Styles.Ticker>{displaySymbol(entry.symbol)}</Styles.Ticker>
                  {index >= 5 && <Styles.Weekday>{weekdayOf(entry.date)}</Styles.Weekday>}
                  {entry.timing && <Styles.Mark aria-hidden="true">{TIMING_MARKS[entry.timing]}</Styles.Mark>}
                  {entry.estimate && <Styles.Mark aria-hidden="true">~</Styles.Mark>}
                </Styles.Entry>
              ))}
            </Styles.Day>
          ))}
        </Styles.Week>
        <Styles.Footer>
          <Styles.Legend>☀ before the opening · ☾ after the close · ~ estimated date</Styles.Legend>
          <Styles.Check>
            <input type="checkbox" checked={badge} onChange={(event) => onBadge(event.target.checked)} />
            Warn in the watchlist when earnings are less than a week away
          </Styles.Check>
        </Styles.Footer>
      </Styles.Dialog>
    </Styles.Backdrop>
  )
}
