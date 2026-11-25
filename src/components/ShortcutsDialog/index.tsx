import { useEffect, useRef, useState } from 'react'
import { focusedBefore, keepTabInside } from '../../domain/dialogFocus'
import * as Styles from './styles'

type ShortcutsDialogProps = { onClose: () => void }

type Group = { title: string; shortcuts: [string, string][] }

const GROUPS: Group[] = [
  {
    title: 'Drawing',
    shortcuts: [
      ['Alt+T', 'Trend line'],
      ['Alt+H', 'Horizontal line'],
      ['Alt+C', 'Channel'],
      ['Alt+R', 'Rectangle'],
      ['Alt+M', 'Measure'],
      ['Esc', 'Back to the cursor, close a menu'],
      ['Delete / Backspace', 'Delete the selected drawing'],
      ['Cmd+Z / Ctrl+Z', 'Undo a change to the drawings'],
      ['Cmd+Shift+Z / Ctrl+Y', 'Redo'],
    ],
  },
  {
    title: 'Search',
    shortcuts: [
      ['A–Z / 0–9', 'Search a symbol, starting with that character'],
      ['Enter', 'Open the first result of the search'],
    ],
  },
  {
    title: 'Watchlist',
    shortcuts: [
      ['↑ / ↓', 'Previous or next symbol of the watchlist'],
      ['Alt+W', 'Hide or show the watchlist'],
    ],
  },
  {
    title: 'Replay',
    shortcuts: [
      ['→', 'Next bar while replaying'],
      ['Esc', 'Leave the replay'],
    ],
  },
  { title: 'Help', shortcuts: [['?', 'This list']] },
]

export const ShortcutsDialog = ({ onClose }: ShortcutsDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [opener] = useState(focusedBefore)

  useEffect(() => () => opener?.focus(), [opener])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <Styles.Backdrop onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <Styles.Dialog ref={dialogRef} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onKeyDown={(event) => keepTabInside(event, dialogRef.current)}>
        <Styles.Title>Keyboard shortcuts</Styles.Title>
        <Styles.Groups>
          {GROUPS.map((group) => (
            <Styles.Group key={group.title}>
              <Styles.GroupTitle>{group.title}</Styles.GroupTitle>
              <Styles.Table>
                <tbody>
                  {group.shortcuts.map(([keys, what]) => (
                    <tr key={`${keys}-${what}`}>
                      <Styles.Keys>
                        <kbd>{keys}</kbd>
                      </Styles.Keys>
                      <Styles.What>{what}</Styles.What>
                    </tr>
                  ))}
                </tbody>
              </Styles.Table>
            </Styles.Group>
          ))}
        </Styles.Groups>
        <Styles.Footer>
          <Styles.Button type="button" autoFocus onClick={onClose}>
            Close
          </Styles.Button>
        </Styles.Footer>
      </Styles.Dialog>
    </Styles.Backdrop>
  )
}
