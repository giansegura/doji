import type { TrendLine } from '../../shared/types'
import { LINE_COLORS } from '../theme/tokens'
import * as Styles from './styles'

type LineToolbarProps = {
  line: TrendLine
  onChange: (line: TrendLine) => void
  onDelete: () => void
}

const WIDTHS = [1, 2, 3, 4]

const ExtendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M3 14L11 8" strokeLinecap="round" />
    <path d="M11 8L17 3.5" strokeLinecap="round" strokeDasharray="1.5 2.5" />
    <circle cx="11" cy="8" r="1.8" />
  </svg>
)

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M3.5 5h11M7 5V3.5h4V5M5 5l.6 9.5h6.8L13 5M7.5 7.5v4.5M10.5 7.5v4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const LineToolbar = ({ line, onChange, onDelete }: LineToolbarProps) => (
  <Styles.Toolbar role="toolbar" aria-label="Línea seleccionada">
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
        aria-label={`Grosor ${width}`}
        aria-pressed={line.width === width}
        onClick={() => onChange({ ...line, width })}
      >
        <Styles.WidthSample $width={width} />
      </Styles.ToolbarButton>
    ))}
    <Styles.ToolbarDivider />
    <Styles.ToolbarButton
      type="button"
      title="Extender a la derecha"
      aria-label="Extender a la derecha"
      aria-pressed={line.extendRight}
      onClick={() => onChange({ ...line, extendRight: !line.extendRight })}
    >
      <ExtendIcon />
    </Styles.ToolbarButton>
    <Styles.ToolbarButton type="button" title="Borrar línea" aria-label="Borrar línea" onClick={onDelete}>
      <TrashIcon />
    </Styles.ToolbarButton>
  </Styles.Toolbar>
)
