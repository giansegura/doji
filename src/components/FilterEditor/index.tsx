import { type KeyboardEvent, type MouseEvent, useState } from 'react'
import { FILTER_FIELDS } from '../../../shared/filters'
import { MAX_FILTER_CONDITIONS } from '../../../shared/limits'
import type { FilterCondition, FilterField, SavedFilter } from '../../../shared/types'
import { FILTER_FIELD_NAMES } from '../../domain/filters'
import * as Styles from './styles'

type FilterEditorProps = {
  filter: SavedFilter
  editing: boolean
  onSave: (filter: SavedFilter) => void
  onDelete: (id: string) => void
  onClose: () => void
}

type Draft = { field: FilterField; op: FilterCondition['op']; value: string }

const NEW_CONDITION: Draft = { field: 'rsi', op: 'below', value: '30' }

const toDraft = (condition: FilterCondition): Draft => ({ ...condition, value: String(condition.value) })

const toCondition = (draft: Draft): FilterCondition | null => {
  const value = draft.value.trim() === '' ? Number.NaN : Number(draft.value)
  return Number.isFinite(value) ? { field: draft.field, op: draft.op, value } : null
}

export const FilterEditor = ({ filter, editing, onSave, onDelete, onClose }: FilterEditorProps) => {
  const [name, setName] = useState(filter.name)
  const [scope, setScope] = useState(filter.scope)
  const [drafts, setDrafts] = useState<Draft[]>(() => filter.conditions.map(toDraft))
  const conditions = drafts.map(toCondition)
  const complete = conditions.filter((condition): condition is FilterCondition => condition !== null)
  const ready = name.trim().length > 0 && drafts.length > 0 && complete.length === drafts.length
  const title = editing ? 'Edit filter' : 'New filter'

  const change = (index: number, patch: Partial<Draft>) =>
    setDrafts((current) => current.map((draft, at) => (at === index ? { ...draft, ...patch } : draft)))

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose()
  }

  const handleBackdrop = (event: MouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }

  const save = () => {
    if (ready) onSave({ id: filter.id, name: name.trim(), scope, conditions: complete })
  }

  return (
    <Styles.Backdrop onClick={handleBackdrop}>
      <Styles.Dialog role="dialog" aria-modal="true" aria-label={title} onKeyDown={handleKeyDown}>
        <Styles.Title>{title}</Styles.Title>
        <Styles.Field>
          Name
          <Styles.Input aria-label="Filter name" value={name} maxLength={40} autoFocus onChange={(event) => setName(event.target.value)} />
        </Styles.Field>
        <Styles.Scope role="radiogroup" aria-label="Apply to">
          <Styles.Radio>
            <input type="radio" name="scope" checked={scope === 'list'} onChange={() => setScope('list')} />
            This watchlist
          </Styles.Radio>
          <Styles.Radio>
            <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
            All watchlists
          </Styles.Radio>
        </Styles.Scope>
        <Styles.Conditions>
          {drafts.map((draft, index) => (
            <Styles.Condition key={index} role="group" aria-label={`Condition ${index + 1}`}>
              <Styles.Select aria-label="Field" value={draft.field} onChange={(event) => change(index, { field: event.target.value as FilterField })}>
                {FILTER_FIELDS.map((field) => (
                  <option key={field} value={field}>
                    {FILTER_FIELD_NAMES[field].name}
                  </option>
                ))}
              </Styles.Select>
              <Styles.Select
                aria-label="Comparison"
                value={draft.op}
                onChange={(event) => change(index, { op: event.target.value as FilterCondition['op'] })}
              >
                <option value="below">below</option>
                <option value="above">above</option>
              </Styles.Select>
              <Styles.Input aria-label="Value" type="number" step="any" value={draft.value} onChange={(event) => change(index, { value: event.target.value })} />
              <Styles.IconButton
                type="button"
                aria-label={`Remove condition ${index + 1}`}
                title="Remove condition"
                onClick={() => setDrafts((current) => current.filter((_, at) => at !== index))}
              >
                ×
              </Styles.IconButton>
            </Styles.Condition>
          ))}
        </Styles.Conditions>
        {drafts.length < MAX_FILTER_CONDITIONS && (
          <Styles.Link type="button" onClick={() => setDrafts((current) => [...current, NEW_CONDITION])}>
            Add condition
          </Styles.Link>
        )}
        <Styles.Footer>
          {editing && (
            <Styles.Button type="button" $danger onClick={() => onDelete(filter.id)}>
              Delete filter
            </Styles.Button>
          )}
          <Styles.Spacer />
          <Styles.Button type="button" onClick={onClose}>
            Cancel
          </Styles.Button>
          <Styles.Button type="button" $primary disabled={!ready} onClick={save}>
            Save
          </Styles.Button>
        </Styles.Footer>
      </Styles.Dialog>
    </Styles.Backdrop>
  )
}
