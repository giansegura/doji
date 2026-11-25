import { useEffect, useRef, useState } from 'react'
import type { SavedFilter } from '../../../shared/types'
import { describeCondition } from '../../domain/filters'
import * as Styles from './styles'

type FilterBarProps = {
  filters: SavedFilter[]
  active: SavedFilter | null
  shown: number
  total: number
  onApply: (id: string | null) => void
  onNew: () => void
  onEdit: () => void
  onSaveAsList: () => void
}

const FunnelIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M1 1.5h10L7 6.5V10L5 11V6.5z" strokeLinejoin="round" />
  </svg>
)

export const FilterBar = ({ filters, active, shown, total, onApply, onNew, onEdit, onSaveAsList }: FilterBarProps) => {
  const [open, setOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const handleDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handleDown)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [open])

  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <Styles.Bar ref={barRef}>
      <Styles.Trigger
        type="button"
        aria-label="Filter"
        aria-haspopup="menu"
        aria-expanded={open}
        title={active ? active.conditions.map(describeCondition).join(' and ') : 'Filter the watchlist'}
        $active={active !== null}
        onClick={() => setOpen((current) => !current)}
      >
        <FunnelIcon />
        <Styles.Name>{active ? active.name : 'Filter'}</Styles.Name>
      </Styles.Trigger>
      {active && <Styles.Count>{`${shown} of ${total}`}</Styles.Count>}
      <Styles.Spacer />
      {active && (
        <>
          <Styles.Action type="button" onClick={onEdit}>
            Edit filter
          </Styles.Action>
          <Styles.Action type="button" disabled={shown === 0} onClick={onSaveAsList}>
            Save as list
          </Styles.Action>
          <Styles.Action type="button" aria-label="Clear filter" title="Clear filter" onClick={() => onApply(null)}>
            ×
          </Styles.Action>
        </>
      )}
      {open && (
        <Styles.Menu role="menu" aria-label="Saved filters">
          {filters.map((filter) => (
            <Styles.Item
              key={filter.id}
              type="button"
              role="menuitem"
              aria-label={filter.scope === 'all' ? `${filter.name} · all watchlists` : filter.name}
              title={filter.conditions.map(describeCondition).join(' and ')}
              onClick={() => choose(() => onApply(filter.id))}
            >
              {filter.name}
              {filter.scope === 'all' && <Styles.Scope> · all watchlists</Styles.Scope>}
            </Styles.Item>
          ))}
          {filters.length > 0 && <Styles.Divider />}
          <Styles.Item type="button" role="menuitem" onClick={() => choose(onNew)}>
            New filter…
          </Styles.Item>
        </Styles.Menu>
      )}
    </Styles.Bar>
  )
}
