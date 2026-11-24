import type { FiredNotice } from '../../hooks/useAlerts'
import * as Styles from './styles'

type AlertToastsProps = {
  fired: FiredNotice[]
  onDismiss: (id: string) => void
}

export const AlertToasts = ({ fired, onDismiss }: AlertToastsProps) => (
  <Styles.Stack>
    {fired.map((notice) => (
      <Styles.Toast key={notice.id} role="status">
        <div>{notice.text}</div>
        <Styles.Time>{notice.time}</Styles.Time>
        <Styles.Close type="button" aria-label={`Dismiss ${notice.text}`} onClick={() => onDismiss(notice.id)}>
          ×
        </Styles.Close>
      </Styles.Toast>
    ))}
  </Styles.Stack>
)
