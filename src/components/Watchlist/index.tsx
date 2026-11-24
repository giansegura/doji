import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { isSection } from '../../../shared/listItems'
import type { ListItem, Quote, SortColumn, WatchlistSort } from '../../../shared/types'
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
  onSort: (column: SortColumn) => void
  header?: ReactNode
}

type Editing = { kind: 'new' } | { kind: 'rename'; id: string } | null

const DRAG_FORMAT = 'application/x-doji-symbol'
const NEW_SECTION: Editing = { kind: 'new' }

type ColumnSpec = { column: SortColumn; label: string; right?: boolean; wideOnly?: boolean; widestOnly?: boolean }

const COLUMNS: ColumnSpec[] = [
  { column: 'symbol', label: 'Symbol' },
  { column: 'last', label: 'Last', right: true, wideOnly: true },
  { column: 'change', label: 'Change %', right: true },
  { column: 'ext', label: 'Ext', right: true, widestOnly: true },
]

const ARROWS = { asc: ' ▲', desc: ' ▼' }

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
  onSort,
  header,
}: WatchlistProps) => {
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
    if (sort === null && dragIndex !== null && dragIndex !== index) onMove(dragIndex, index)
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

  return (
    <Styles.Panel>
      <Styles.Header>
        {header ?? <Styles.Title>Watchlist</Styles.Title>}
        <Styles.HeaderActions>
          <Styles.IconButton type="button" aria-label="Add section" title="Add section" onClick={() => setEditing(NEW_SECTION)}>
            <SectionIcon />
          </Styles.IconButton>
          <Styles.IconButton type="button" aria-label="Add symbol" title="Add symbol" onClick={onAdd}>
            +
          </Styles.IconButton>
        </Styles.HeaderActions>
      </Styles.Header>
      <Styles.Columns>
        {COLUMNS.map(({ column, label, right, wideOnly, widestOnly }) => (
          <Styles.ColumnLabel
            key={column}
            type="button"
            aria-label={sortLabel(column, label, sort)}
            title={sortLabel(column, label, sort)}
            $right={right}
            $wideOnly={wideOnly}
            $widestOnly={widestOnly}
            $sorted={sort?.column === column}
            onClick={() => onSort(column)}
          >
            {label}
            {sort?.column === column && ARROWS[sort.direction]}
          </Styles.ColumnLabel>
        ))}
      </Styles.Columns>
      {items.length === 0 && <Styles.Empty>This watchlist is empty</Styles.Empty>}
      <Styles.Rows>
        {items.map((item, index) => (
          <Styles.Row
            key={keyOf(item)}
            ref={!isSection(item) && item.symbol === activeSymbol ? activeRef : undefined}
            draggable={editing === null && sort === null}
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
                onSelect={() => onSelect(item.symbol)}
                onRemove={() => onRemove(item.symbol)}
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
    </Styles.Panel>
  )
}
