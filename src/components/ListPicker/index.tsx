import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { LIST_NAME_MAX_LENGTH, MAX_LISTS } from '../../../shared/limits'
import { LIST_ICONS, toListIcon } from '../../../shared/listIcon'
import type { SymbolList } from '../../../shared/types'
import * as Styles from './styles'

type ListPickerProps = {
  lists: SymbolList[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onIcon: (id: string, icon: string | null) => void
}

type Mode =
  | { kind: 'browse' }
  | { kind: 'create' }
  | { kind: 'rename'; id: string }
  | { kind: 'confirm'; id: string }
  | { kind: 'icon'; id: string }

const BROWSE: Mode = { kind: 'browse' }

const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M2.5 11.5l.5-2.5 6.5-6.5 2 2L5 11l-2.5.5z" strokeLinejoin="round" />
  </svg>
)

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <rect x="4.5" y="4.5" width="7" height="7" rx="1" />
    <path d="M9.5 4.5V3a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 .5.5h1.5" strokeLinecap="round" />
  </svg>
)

const SmileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <circle cx="7" cy="7" r="5" />
    <path d="M4.9 8.3c.5.7 1.2 1.1 2.1 1.1s1.6-.4 2.1-1.1" strokeLinecap="round" />
    <circle cx="5.3" cy="5.7" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="8.7" cy="5.7" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M2.5 4h9M5.5 4V2.8h3V4M3.8 4l.5 7.5h5.4l.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const ListPicker = ({ lists, activeId, onSelect, onCreate, onRename, onDelete, onDuplicate, onIcon }: ListPickerProps) => {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(BROWSE)
  const [text, setText] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const iconButtonsRef = useRef(new Map<string, HTMLButtonElement>())
  const active = lists.find((list) => list.id === activeId) ?? lists[0]
  const browsing = mode.kind === 'browse'

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && browsing) setOpen(false)
    }
    const closeOnOutside = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
      setMode(BROWSE)
    }
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('pointerdown', closeOnOutside)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('pointerdown', closeOnOutside)
    }
  }, [open, browsing])

  const startEditing = (next: Mode, initialText: string) => {
    setText(initialText)
    setMode(next)
  }

  const close = () => {
    setOpen(false)
    setMode(BROWSE)
  }

  const handleSelect = (id: string) => {
    onSelect(id)
    close()
  }

  const commit = () => {
    const name = text.trim()
    if (mode.kind === 'create' && name) {
      onCreate(name)
      close()
    }
    if (mode.kind === 'rename') {
      if (name) onRename(mode.id, name)
      setMode(BROWSE)
    }
  }

  const handleInputKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') {
      event.stopPropagation()
      setMode(BROWSE)
    }
  }

  const handleDuplicate = (id: string) => {
    onDuplicate(id)
    close()
  }

  const chooseIcon = (id: string, icon: string | null) => {
    onIcon(id, icon)
    setMode(BROWSE)
  }

  const handleIconKey = (event: KeyboardEvent, id: string) => {
    if (event.key !== 'Enter') return
    const icon = toListIcon(text)
    if (icon) chooseIcon(id, icon)
  }

  const handlePaletteKey = (event: KeyboardEvent, id: string) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    setMode(BROWSE)
    iconButtonsRef.current.get(id)?.focus()
  }

  const keepIconButton = (id: string) => (node: HTMLButtonElement | null) => {
    if (node) iconButtonsRef.current.set(id, node)
    else iconButtonsRef.current.delete(id)
  }

  const handleDelete = (id: string) => {
    onDelete(id)
    setMode(BROWSE)
  }

  return (
    <Styles.Root ref={rootRef}>
      <Styles.Trigger
        type="button"
        aria-label="Watchlists"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {active?.icon && <Styles.ListIcon aria-hidden="true">{active.icon}</Styles.ListIcon>}
        <Styles.TriggerName>{active?.name ?? 'Watchlist'}</Styles.TriggerName>
        <ChevronIcon />
      </Styles.Trigger>
      {open && (
        <Styles.Menu role="menu">
          {lists.map((list) => (
            <div key={list.id} role="none">
            <Styles.Row role="none">
              {mode.kind === 'rename' && mode.id === list.id && (
                <Styles.Input
                  type="text"
                  autoFocus
                  aria-label={`New name for ${list.name}`}
                  maxLength={LIST_NAME_MAX_LENGTH}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleInputKey}
                />
              )}
              {mode.kind === 'confirm' && mode.id === list.id && (
                <>
                  <Styles.Question>{`Delete “${list.name}”?`}</Styles.Question>
                  <Styles.TextButton
                    type="button"
                    $danger
                    aria-label={`Confirm deleting ${list.name}`}
                    onClick={() => handleDelete(list.id)}
                  >
                    Delete
                  </Styles.TextButton>
                  <Styles.TextButton type="button" onClick={() => setMode(BROWSE)}>
                    Cancel
                  </Styles.TextButton>
                </>
              )}
              {!((mode.kind === 'rename' || mode.kind === 'confirm') && mode.id === list.id) && (
                <>
                  <Styles.Item
                    type="button"
                    role="menuitem"
                    aria-current={list.id === active?.id ? 'true' : undefined}
                    onClick={() => handleSelect(list.id)}
                  >
                    {list.icon && <Styles.ListIcon aria-hidden="true">{list.icon}</Styles.ListIcon>}
                    <Styles.ItemName>{list.name}</Styles.ItemName>
                  </Styles.Item>
                  <Styles.IconButton
                    ref={keepIconButton(list.id)}
                    type="button"
                    title="Icon"
                    aria-label={`Icon for ${list.name}`}
                    aria-expanded={mode.kind === 'icon' && mode.id === list.id}
                    onClick={() =>
                      mode.kind === 'icon' && mode.id === list.id ? setMode(BROWSE) : startEditing({ kind: 'icon', id: list.id }, '')
                    }
                  >
                    <SmileIcon />
                  </Styles.IconButton>
                  <Styles.IconButton
                    type="button"
                    title="Rename"
                    aria-label={`Rename ${list.name}`}
                    onClick={() => startEditing({ kind: 'rename', id: list.id }, list.name)}
                  >
                    <PencilIcon />
                  </Styles.IconButton>
                  <Styles.IconButton
                    type="button"
                    title="Duplicate"
                    aria-label={`Duplicate ${list.name}`}
                    disabled={lists.length >= MAX_LISTS}
                    onClick={() => handleDuplicate(list.id)}
                  >
                    <CopyIcon />
                  </Styles.IconButton>
                  <Styles.IconButton
                    type="button"
                    title="Delete"
                    aria-label={`Delete ${list.name}`}
                    disabled={lists.length <= 1}
                    onClick={() => setMode({ kind: 'confirm', id: list.id })}
                  >
                    <TrashIcon />
                  </Styles.IconButton>
                </>
              )}
            </Styles.Row>
            {mode.kind === 'icon' && mode.id === list.id && (
              <Styles.Palette role="group" aria-label={`Icons for ${list.name}`} onKeyDown={(event) => handlePaletteKey(event, list.id)}>
                <Styles.PaletteGrid>
                  {LIST_ICONS.map((icon) => (
                    <Styles.PaletteIcon
                      key={icon}
                      type="button"
                      aria-label={icon}
                      aria-pressed={list.icon === icon}
                      onClick={() => chooseIcon(list.id, icon)}
                    >
                      {icon}
                    </Styles.PaletteIcon>
                  ))}
                </Styles.PaletteGrid>
                <Styles.PaletteFooter>
                  <Styles.Input
                    type="text"
                    autoFocus
                    aria-label={`Any emoji for ${list.name}`}
                    placeholder="Any emoji, then Enter"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => handleIconKey(event, list.id)}
                  />
                  <Styles.TextButton type="button" disabled={!list.icon} onClick={() => chooseIcon(list.id, null)}>
                    No icon
                  </Styles.TextButton>
                </Styles.PaletteFooter>
              </Styles.Palette>
            )}
            </div>
          ))}
          <Styles.Footer>
            {mode.kind === 'create' ? (
              <Styles.Input
                type="text"
                autoFocus
                aria-label="Name of the new watchlist"
                placeholder="Watchlist name"
                maxLength={LIST_NAME_MAX_LENGTH}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleInputKey}
              />
            ) : (
              <Styles.CreateButton
                type="button"
                disabled={lists.length >= MAX_LISTS}
                onClick={() => startEditing({ kind: 'create' }, '')}
              >
                New watchlist
              </Styles.CreateButton>
            )}
          </Styles.Footer>
        </Styles.Menu>
      )}
    </Styles.Root>
  )
}
