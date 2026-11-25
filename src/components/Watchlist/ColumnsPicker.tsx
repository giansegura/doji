import { useEffect, useRef, useState } from 'react'
import { WATCH_COLUMNS } from '../../../shared/watchColumns'
import type { WatchColumn } from '../../../shared/types'
import { WATCH_COLUMN_NAMES } from '../../domain/watchColumns'
import * as Styles from './styles'

type ColumnsPickerProps = {
  columns: WatchColumn[]
  onColumns: (columns: WatchColumn[]) => void
  onlyFlagged: boolean
  onOnlyFlagged?: (on: boolean) => void
}

const ColumnsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M6.5 3v10M10 3v10" />
  </svg>
)

export const ColumnsPicker = ({ columns, onColumns, onlyFlagged, onOnlyFlagged }: ColumnsPickerProps) => {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const handleDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handleDown)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [open])

  const toggle = (column: WatchColumn, on: boolean) =>
    onColumns(on ? WATCH_COLUMNS.filter((option) => option === column || columns.includes(option)) : columns.filter((option) => option !== column))

  return (
    <Styles.Picker ref={pickerRef}>
      <Styles.IconButton type="button" aria-label="Columns" title="Columns" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <ColumnsIcon />
      </Styles.IconButton>
      {open && (
        <Styles.ColumnsMenu role="group" aria-label="Columns">
          <Styles.ColumnsTitle>Columns</Styles.ColumnsTitle>
          {WATCH_COLUMNS.map((column) => (
            <Styles.ColumnOption key={column}>
              <input type="checkbox" checked={columns.includes(column)} onChange={(event) => toggle(column, event.target.checked)} />
              {WATCH_COLUMN_NAMES[column].name}
            </Styles.ColumnOption>
          ))}
          {onOnlyFlagged && (
            <>
              <Styles.ColumnsTitle>View</Styles.ColumnsTitle>
              <Styles.ColumnOption>
                <input type="checkbox" checked={onlyFlagged} onChange={(event) => onOnlyFlagged(event.target.checked)} />
                Only flagged symbols
              </Styles.ColumnOption>
            </>
          )}
        </Styles.ColumnsMenu>
      )}
    </Styles.Picker>
  )
}
