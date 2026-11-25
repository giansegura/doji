import type { ReactNode } from 'react'
import type { Tool } from '../../state/appReducer'
import * as Styles from './styles'

type LeftToolbarProps = { tool: Tool; onTool: (tool: Tool) => void }

const CursorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M11 3v6M11 13v6M3 11h6M13 11h6" strokeLinecap="round" />
  </svg>
)

const TrendLineIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M6.4 15.6L15.6 6.4" strokeLinecap="round" />
    <circle cx="5" cy="17" r="2" />
    <circle cx="17" cy="5" r="2" />
  </svg>
)

const HorizontalLineIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M3 11h6M13 11h6" strokeLinecap="round" />
    <circle cx="11" cy="11" r="2" />
  </svg>
)

const ChannelIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M5.2 12.6L13.6 4.8M8.4 17.2L16.8 9.4" strokeLinecap="round" />
    <circle cx="4" cy="13.8" r="1.7" />
    <circle cx="14.8" cy="3.7" r="1.7" />
    <circle cx="18" cy="8.2" r="1.7" />
  </svg>
)

const RectangleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M6.8 6h8.4M17 7.8v6.4M15.2 16H6.8M5 14.2V7.8" strokeLinecap="round" />
    <circle cx="5" cy="6" r="1.7" />
    <circle cx="17" cy="6" r="1.7" />
    <circle cx="17" cy="16" r="1.7" />
    <circle cx="5" cy="16" r="1.7" />
  </svg>
)

const RulerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M4.5 13.5l9-9 4 4-9 9-4-4z" strokeLinejoin="round" />
    <path d="M7.5 10.5l1.6 1.6M10 8l1.6 1.6M12.5 5.5l1.6 1.6" strokeLinecap="round" />
  </svg>
)

const LongIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M4 11h14M4 4.5h14v13H4z" strokeLinejoin="round" />
    <path d="M11 9.5V5.8M9.3 7.4L11 5.7l1.7 1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ShortIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M4 11h14M4 4.5h14v13H4z" strokeLinejoin="round" />
    <path d="M11 12.5v3.7M9.3 14.6l1.7 1.7 1.7-1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TOOLS: { tool: Tool; label: string; icon: ReactNode }[] = [
  { tool: 'cursor', label: 'Cursor', icon: <CursorIcon /> },
  { tool: 'trendline', label: 'Trend line', icon: <TrendLineIcon /> },
  { tool: 'hline', label: 'Horizontal line', icon: <HorizontalLineIcon /> },
  { tool: 'channel', label: 'Parallel channel', icon: <ChannelIcon /> },
  { tool: 'rect', label: 'Rectangle', icon: <RectangleIcon /> },
  { tool: 'long', label: 'Long position', icon: <LongIcon /> },
  { tool: 'short', label: 'Short position', icon: <ShortIcon /> },
  { tool: 'measure', label: 'Measure', icon: <RulerIcon /> },
]

export const LeftToolbar = ({ tool, onTool }: LeftToolbarProps) => (
  <Styles.Bar aria-label="Tools">
    {TOOLS.map((item) => (
      <Styles.ToolButton
        key={item.tool}
        type="button"
        title={item.label}
        aria-label={item.label}
        aria-pressed={item.tool === tool}
        $active={item.tool === tool}
        onClick={() => onTool(item.tool)}
      >
        {item.icon}
      </Styles.ToolButton>
    ))}
  </Styles.Bar>
)
