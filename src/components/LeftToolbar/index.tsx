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

const TOOLS: { tool: Tool; label: string; icon: ReactNode }[] = [
  { tool: 'cursor', label: 'Cursor', icon: <CursorIcon /> },
  { tool: 'trendline', label: 'Trend line', icon: <TrendLineIcon /> },
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
