import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { useTheme } from 'styled-components'
import { isSection } from '../../../shared/listItems'
import type { SymbolMetrics } from '../../../shared/symbolMetrics'
import type { Earnings, FlagColor, Holding, ListItem, Quote, SortColumn, WatchColumn, WatchlistSort } from '../../../shared/types'
import { formatPercent } from '../../chart/format'
import { formatMoney, totalsByCurrency } from '../../domain/holdings'
import { WATCH_COLUMN_NAMES } from '../../domain/watchColumns'
import { ColumnsPicker } from './ColumnsPicker'
import { FlagIcon } from './FlagPicker'
import { SectionField } from './SectionField'
import { SectionRow } from './SectionRow'
import { SymbolRow } from './SymbolRow'
import * as Styles from './styles'

type WatchlistProps = {
  items: ListItem[]
  quotes: Record<string, Quote>
  activeSymbol: string
  onSelect: (symbol: string) => void
  onRemove: (symbol: string) => void
  onMove: (from: number, to: number) => void
  onAdd: () => void
  onAddSection: (title: string) => void
  onRenameSection: (id: string, title: string) => void
  onRemoveSection: (id: string) => void
  sort: WatchlistSort | null
  live?: boolean
  onSort: (column: SortColumn) => void
  header?: ReactNode
  earningsSoon?: Record<string, number>
  columns?: WatchColumn[]
  onColumns?: (columns: WatchColumn[]) => void
  metrics?: Record<string, SymbolMetrics>
  earnings?: Record<string, Earnings>
  flags?: Record<string, FlagColor>
  onFlag?: (symbol: string, color: FlagColor | null) => void
  onlyFlagged?: boolean
  onOnlyFlagged?: (on: boolean) => void
  toolbar?: ReactNode
  filtered?: 'list' | 'all' | null
  holdings?: Record<string, Holding>
}

type Editing = { kind: 'new' } | { kind: 'rename'; id: string } | null

const DRAG_FORMAT = 'application/x-doji-symbol'
const NEW_SECTION: Editing = { kind: 'new' }

type ColumnSpec = { column: SortColumn; label: string; header?: string; right?: boolean; wideOnly?: boolean; widestOnly?: boolean }

const COLUMNS: ColumnSpec[] = [
  { column: 'symbol', label: 'Symbol' },
  { column: 'last', label: 'Last', right: true, wideOnly: true },
  { column: 'change', label: 'Chg%', right: true },
  { column: 'ext', label: 'Ext', right: true, widestOnly: true },
]

const ARROWS = { asc: ' ▲', desc: ' ▼' }

const NO_COLUMNS: WatchColumn[] = []
const NO_METRICS: Record<string, SymbolMetrics> = {}
const NO_EARNINGS: Record<string, Earnings> = {}
const NO_FLAGS: Record<string, FlagColor> = {}
const NO_HOLDINGS: Record<string, Holding> = {}

const LIVE = 'Live prices'

const NOT_LIVE = 'Prices refresh every 15 seconds'

const DIRECTIONS = { asc: 'lowest first', desc: 'highest first' }

const SYMBOL_DIRECTIONS = { asc: 'A to Z', desc: 'Z to A' }

const sortLabel = (column: SortColumn, label: string, sort: WatchlistSort | null): string => {
  if (sort?.column !== column) return `Sort by ${label}`
  const direction = column === 'symbol' ? SYMBOL_DIRECTIONS[sort.direction] : DIRECTIONS[sort.direction]
  return `Sort by ${label}, ${direction}`
}

const keyOf = (item: ListItem): string => (isSection(item) ? `section:${item.id}` : item.symbol)

const SectionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M2 4h12M2 8h7M2 12h7M12 8v4M10 10h4" strokeLinecap="round" />
  </svg>
)

export const Watchlist = ({
  items,
  quotes,
  activeSymbol,
  onSelect,
  onRemove,
  onMove,
  onAdd,
  onAddSection,
  onRenameSection,
  onRemoveSection,
  sort,
  live = false,
  onSort,
  header,
  earningsSoon,
  columns = NO_COLUMNS,
  onColumns,
  metrics = NO_METRICS,
  earnings = NO_EARNINGS,
  flags = NO_FLAGS,
  onFlag,
  onlyFlagged = false,
  onOnlyFlagged,
  toolbar,
  filtered = null,
  holdings = NO_HOLDINGS,
}: WatchlistProps) => {
  const theme = useTheme()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const activeRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [activeSymbol])

  const handleDragStart = (event: DragEvent, index: number) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_FORMAT, keyOf(items[index]))
    setDragIndex(index)
  }

  const handleDrop = (event: DragEvent, index: number) => {
    event.preventDefault()
    if (!fixed && dragIndex !== null && dragIndex !== index) onMove(dragIndex, index)
    setDragIndex(null)
  }

  const handleNewSection = (title: string) => {
    onAddSection(title)
    setEditing(null)
  }

  const handleRename = (id: string, title: string) => {
    onRenameSection(id, title)
    setEditing(null)
  }

  const fixed = sort !== null || onlyFlagged || filtered !== null
  const emptyText = filtered ? 'No symbols match this filter' : onlyFlagged ? 'No flagged symbols in this watchlist' : 'This watchlist is empty'

  const showsGain = columns.includes('gain') || columns.includes('gainValue')
  const totals = showsGain
    ? totalsByCurrency(
        items.flatMap((item) => (isSection(item) ? [] : [item.symbol])),
        holdings,
        quotes,
      )
    : []

  const specs: ColumnSpec[] = [
    ...COLUMNS,
    ...columns.map((column) => ({ column, label: WATCH_COLUMN_NAMES[column].name, header: WATCH_COLUMN_NAMES[column].header, right: true })),
  ]

  return (
    <Styles.Panel>
      <Styles.Header>
        {header ?? <Styles.Title>Watchlist</Styles.Title>}
        <Styles.HeaderActions>
          <Styles.LiveMark role="img" aria-label={live ? LIVE : NOT_LIVE} title={live ? LIVE : NOT_LIVE} $live={live} />
          {onColumns && <ColumnsPicker columns={columns} onColumns={onColumns} onlyFlagged={onlyFlagged} onOnlyFlagged={onOnlyFlagged} />}
          <Styles.IconButton type="button" aria-label="Add section" title="Add section" onClick={() => setEditing(NEW_SECTION)}>
            <SectionIcon />
          </Styles.IconButton>
          <Styles.IconButton type="button" aria-label="Add symbol" title="Add symbol" onClick={onAdd}>
            +
          </Styles.IconButton>
        </Styles.HeaderActions>
      </Styles.Header>
      {toolbar}
      <Styles.Columns $extra={columns.length}>
        {onFlag && (
          <Styles.FlagSort
            type="button"
            aria-label={sortLabel('flag', 'Flag', sort)}
            title={sortLabel('flag', 'Flag', sort)}
            $sorted={sort?.column === 'flag'}
            onClick={() => onSort('flag')}
          >
            <FlagIcon />
          </Styles.FlagSort>
        )}
        {specs.map(({ column, label, header: shortLabel, right, wideOnly, widestOnly }) => (
          <Styles.ColumnLabel
            key={column}
            type="button"
            aria-label={sortLabel(column, label, sort)}
            title={sortLabel(column, label, sort)}
            $right={right}
            $wideOnly={wideOnly}
            $widestOnly={widestOnly}
            $extra={columns.length}
            $sorted={sort?.column === column}
            onClick={() => onSort(column)}
          >
            {shortLabel ?? label}
            {sort?.column === column && ARROWS[sort.direction]}
          </Styles.ColumnLabel>
        ))}
      </Styles.Columns>
      {items.length === 0 && <Styles.Empty>{emptyText}</Styles.Empty>}
      <Styles.Rows>
        {items.map((item, index) => (
          <Styles.Row
            key={keyOf(item)}
            ref={!isSection(item) && item.symbol === activeSymbol ? activeRef : undefined}
            draggable={editing === null && !fixed}
            $dragging={dragIndex === index}
            onDragStart={(event) => handleDragStart(event, index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, index)}
            onDragEnd={() => setDragIndex(null)}
          >
            {isSection(item) ? (
              <SectionRow
                section={item}
                editing={editing?.kind === 'rename' && editing.id === item.id}
                onEdit={() => setEditing({ kind: 'rename', id: item.id })}
                onRename={(title) => handleRename(item.id, title)}
                onCancel={() => setEditing(null)}
                onRemove={() => onRemoveSection(item.id)}
              />
            ) : (
              <SymbolRow
                item={item}
                quote={quotes[item.symbol]}
                active={item.symbol === activeSymbol}
                earningsIn={earningsSoon?.[item.symbol.toUpperCase()]}
                columns={columns}
                metrics={metrics[item.symbol.toUpperCase()]}
                earnings={earnings[item.symbol.toUpperCase()]}
                flag={flags[item.symbol] ?? null}
                holding={holdings[item.symbol]}
                onFlag={onFlag ? (color) => onFlag(item.symbol, color) : undefined}
                onSelect={() => onSelect(item.symbol)}
                onRemove={filtered === 'all' ? undefined : () => onRemove(item.symbol)}
              />
            )}
          </Styles.Row>
        ))}
        {editing?.kind === 'new' && (
          <Styles.Row $dragging={false}>
            <Styles.Section>
              <SectionField label="New section name" initial="" onCommit={handleNewSection} onCancel={() => setEditing(null)} />
            </Styles.Section>
          </Styles.Row>
        )}
      </Styles.Rows>
      {totals.length > 0 && (
        <Styles.Total role="status" aria-label="Total gain">
          <Styles.TotalLabel>Total P/L</Styles.TotalLabel>
          {totals.map((total) => (
            <Styles.Number key={total.currency} $color={total.value < 0 ? theme.ui.down : theme.ui.up}>
              {`${formatMoney(total.value, total.currency || undefined)} (${formatPercent(total.percent)})`}
            </Styles.Number>
          ))}
        </Styles.Total>
      )}
    </Styles.Panel>
  )
}
