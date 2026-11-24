import { type KeyboardEvent, useState } from 'react'
import * as Styles from './styles'

type SectionFieldProps = {
  label: string
  initial: string
  onCommit: (title: string) => void
  onCancel: () => void
}

export const SectionField = ({ label, initial, onCommit, onCancel }: SectionFieldProps) => {
  const [text, setText] = useState(initial)

  const handleKey = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') onCancel()
    if (event.key !== 'Enter') return
    const title = text.trim()
    if (title) onCommit(title)
    else onCancel()
  }

  return (
    <Styles.SectionInput
      autoFocus
      aria-label={label}
      placeholder="Section name"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={handleKey}
      onBlur={onCancel}
    />
  )
}
