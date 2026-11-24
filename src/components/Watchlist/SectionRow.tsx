import type { ListSection } from '../../../shared/types'
import { SectionField } from './SectionField'
import * as Styles from './styles'

type SectionRowProps = {
  section: ListSection
  editing: boolean
  onEdit: () => void
  onRename: (title: string) => void
  onCancel: () => void
  onRemove: () => void
}

const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M2 10l.5-2.2 5.8-5.8 1.7 1.7-5.8 5.8L2 10z" strokeLinejoin="round" />
  </svg>
)

export const SectionRow = ({ section, editing, onEdit, onRename, onCancel, onRemove }: SectionRowProps) => {
  if (editing) {
    return (
      <Styles.Section>
        <SectionField label="Section name" initial={section.title} onCommit={onRename} onCancel={onCancel} />
      </Styles.Section>
    )
  }

  return (
    <Styles.Section>
      <Styles.SectionTitle>{section.title}</Styles.SectionTitle>
      <Styles.SectionButton type="button" title="Rename" aria-label={`Rename section ${section.title}`} onClick={onEdit}>
        <PencilIcon />
      </Styles.SectionButton>
      <Styles.SectionButton type="button" title="Remove" aria-label={`Remove section ${section.title}`} onClick={onRemove}>
        ×
      </Styles.SectionButton>
    </Styles.Section>
  )
}
