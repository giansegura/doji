import type { Drawing } from '../../shared/types'
import { LINE_COLORS } from '../theme/tokens'
import * as Styles from './styles'

type LineToolbarProps = {
  line: Drawing
  onChange: (line: Drawing) => void
  onDelete: () => void
  onArm?: () => void
}

const WIDTHS = [1, 2, 3, 4]

const ExtendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M3 14L11 8" strokeLinecap="round" />
    <path d="M11 8L17 3.5" strokeLinecap="round" strokeDasharray="1.5 2.5" />
    <circle cx="11" cy="8" r="1.8" />
  </svg>
)

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M4.5 13h9l-1.1-1.6V8.2a3.4 3.4 0 0 0-6.8 0v3.2L4.5 13zM7.6 15h2.8M9 3.4V4.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M3.5 5h11M7 5V3.5h4V5M5 5l.6 9.5h6.8L13 5M7.5 7.5v4.5M10.5 7.5v4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const LineToolbar = ({ line, onChange, onDelete, onArm }: LineToolbarProps) => (
  <Styles.Toolbar role="toolbar" aria-label="Selected line">
    {LINE_COLORS.map((color) => (
      <Styles.Swatch
        key={color}
        type="button"
        aria-label={`Color ${color}`}
        aria-pressed={line.color === color}
        $color={color}
        onClick={() => onChange({ ...line, color })}
      />
    ))}
    <Styles.ToolbarDivider />
    {WIDTHS.map((width) => (
      <Styles.ToolbarButton
        key={width}
        type="button"
        aria-label={`Width ${width}`}
        aria-pressed={line.width === width}
        onClick={() => onChange({ ...line, width })}
      >
        <Styles.WidthSample $width={width} />
      </Styles.ToolbarButton>
    ))}
    <Styles.ToolbarDivider />
    {(line.kind === undefined || line.kind === 'trend') && (
      <Styles.ToolbarButton
        type="button"
        title="Extend right"
        aria-label="Extend right"
        aria-pressed={line.extendRight}
        onClick={() => onChange({ ...line, extendRight: !line.extendRight })}
      >
        <ExtendIcon />
      </Styles.ToolbarButton>
    )}
    {line.pane === 'price' && (line.kind === undefined || line.kind === 'trend' || line.kind === 'hline') && (
      <Styles.ToolbarButton
        type="button"
        title="Alert when the price crosses it"
        aria-label="Alert"
        aria-pressed={line.alert === true}
        onClick={() => {
          if (!line.alert) onArm?.()
          onChange({ ...line, alert: !line.alert })
        }}
      >
        <BellIcon />
      </Styles.ToolbarButton>
    )}
    <Styles.ToolbarButton type="button" title="Delete line" aria-label="Delete line" onClick={onDelete}>
      <TrashIcon />
    </Styles.ToolbarButton>
  </Styles.Toolbar>
)
