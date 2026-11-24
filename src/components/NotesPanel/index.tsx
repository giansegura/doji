import { useState } from 'react'
import { NOTE_MAX_LENGTH } from '../../../shared/limits'
import * as Styles from './styles'

type NotesPanelProps = {
  symbol: string
  text: string
  onChange: (text: string) => void
}

export const NotesPanel = ({ symbol, text, onChange }: NotesPanelProps) => {
  const [open, setOpen] = useState(false)
  const label = `Notes for ${symbol}`

  return (
    <Styles.Panel>
      <Styles.Toggle type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Styles.Label>Notes</Styles.Label>
        {text.length > 0 && <Styles.Mark role="img" aria-label="Has a note" />}
        <Styles.Symbol>{symbol}</Styles.Symbol>
        <Styles.Chevron $open={open}>▲</Styles.Chevron>
      </Styles.Toggle>
      {open && (
        <Styles.Text
          aria-label={label}
          placeholder="Thesis, entry price, plan…"
          maxLength={NOTE_MAX_LENGTH}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Styles.Panel>
  )
}
