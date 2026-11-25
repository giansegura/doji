import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import type { Tool } from '../../state/appReducer'
import * as Styles from './styles'

type LeftToolbarProps = {
  tool: Tool
  onTool: (tool: Tool) => void
  hidden?: boolean
  onHidden?: (on: boolean) => void
  locked?: boolean
  onLocked?: (on: boolean) => void
  drawingsList?: ReactNode
}

const LIST = 'list'

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

const RayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M8 11h11" strokeLinecap="round" />
    <circle cx="6" cy="11" r="2" />
  </svg>
)

const VerticalLineIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M11 3v6M11 13v6" strokeLinecap="round" />
    <circle cx="11" cy="11" r="2" />
  </svg>
)

const ZoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M3 8h16M3 14h16" strokeLinecap="round" />
    <path d="M3 9.5h16M3 11h16M3 12.5h16" strokeLinecap="round" strokeOpacity="0.35" />
  </svg>
)

const TextIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M5 6h12M11 6v11M8.5 17h5" strokeLinecap="round" />
  </svg>
)

type ToolItem = { tool: Tool; label: string; icon: ReactNode }

type Group = { id: string; name?: string; more?: string; tools: ToolItem[] }

const GROUPS: Group[] = [
  { id: 'cursor', tools: [{ tool: 'cursor', label: 'Cursor', icon: <CursorIcon /> }] },
  {
    id: 'lines',
    name: 'Line tools',
    more: 'More line tools',
    tools: [
      { tool: 'trendline', label: 'Trend line', icon: <TrendLineIcon /> },
      { tool: 'hline', label: 'Horizontal line', icon: <HorizontalLineIcon /> },
      { tool: 'ray', label: 'Horizontal ray', icon: <RayIcon /> },
      { tool: 'vline', label: 'Vertical line', icon: <VerticalLineIcon /> },
    ],
  },
  {
    id: 'shapes',
    name: 'Shapes',
    more: 'More shapes',
    tools: [
      { tool: 'channel', label: 'Parallel channel', icon: <ChannelIcon /> },
      { tool: 'rect', label: 'Rectangle', icon: <RectangleIcon /> },
      { tool: 'zone', label: 'Horizontal zone', icon: <ZoneIcon /> },
    ],
  },
  { id: 'text', tools: [{ tool: 'note', label: 'Text', icon: <TextIcon /> }] },
  {
    id: 'positions',
    name: 'Position tools',
    more: 'More position tools',
    tools: [
      { tool: 'long', label: 'Long position', icon: <LongIcon /> },
      { tool: 'short', label: 'Short position', icon: <ShortIcon /> },
    ],
  },
  { id: 'measure', tools: [{ tool: 'measure', label: 'Measure', icon: <RulerIcon /> }] },
]

const EyeIcon = ({ closed }: { closed: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M3 11s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S3 11 3 11z" />
    <circle cx="11" cy="11" r="2.3" />
    {closed && <path d="M4.5 17.5l13-13" strokeLinecap="round" />}
  </svg>
)

const LockIcon = ({ shut }: { shut: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M6 10.5h10v8H6z" strokeLinejoin="round" />
    <path d={shut ? 'M8 10.5V8a3 3 0 0 1 6 0v2.5' : 'M8 10.5V8a3 3 0 0 1 5.8-1.1'} strokeLinecap="round" />
  </svg>
)

const ListIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M8 6.5h10M8 11h10M8 15.5h10" strokeLinecap="round" />
    <circle cx="4.8" cy="6.5" r="1" />
    <circle cx="4.8" cy="11" r="1" />
    <circle cx="4.8" cy="15.5" r="1" />
  </svg>
)

const MENU_KEYS: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at) => at + 1,
  ArrowUp: (at) => at - 1,
  Home: () => 0,
  End: (_, count) => count - 1,
}

export const LeftToolbar = ({ tool, onTool, hidden = false, onHidden, locked = false, onLocked, drawingsList }: LeftToolbarProps) => {
  const [chosen, setChosen] = useState<Record<string, Tool>>({})
  const [open, setOpen] = useState<string | null>(null)
  const barRef = useRef<HTMLElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const triggersRef = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    flyoutRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(null)
      triggersRef.current[open]?.focus()
    }
    const handleDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handleDown)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handleDown)
    }
  }, [open])

  const pick = (group: Group, item: ToolItem) => {
    setChosen((current) => ({ ...current, [group.id]: item.tool }))
    setOpen(null)
    onTool(item.tool)
  }

  const pickFromMenu = (group: Group, item: ToolItem) => {
    pick(group, item)
    triggersRef.current[group.id]?.focus()
  }

  const moveInMenu = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const at = items.findIndex((item) => item === document.activeElement)
    const target = MENU_KEYS[event.key]?.(at, items.length)
    if (target === undefined) return
    event.preventDefault()
    items[(target + items.length) % items.length]?.focus()
  }

  const shownOf = (group: Group): ToolItem =>
    group.tools.find((item) => item.tool === tool) ?? group.tools.find((item) => item.tool === chosen[group.id]) ?? group.tools[0]

  return (
    <Styles.Bar ref={barRef} aria-label="Tools">
      {GROUPS.map((group) => {
        const shown = shownOf(group)
        return (
          <Styles.Group key={group.id}>
            <Styles.ToolButton
              type="button"
              title={shown.label}
              aria-label={shown.label}
              aria-pressed={shown.tool === tool}
              $active={shown.tool === tool}
              onClick={() => pick(group, shown)}
            >
              {shown.icon}
            </Styles.ToolButton>
            {group.more && (
              <Styles.More
                type="button"
                title={group.more}
                aria-label={group.more}
                aria-expanded={open === group.id}
                ref={(element) => {
                  triggersRef.current[group.id] = element
                }}
                onClick={() => setOpen((current) => (current === group.id ? null : group.id))}
              />
            )}
            {open === group.id && (
              <Styles.Flyout ref={flyoutRef} role="menu" aria-label={group.name} onKeyDown={moveInMenu}>
                {group.tools.map((item) => (
                  <Styles.FlyoutItem
                    key={item.tool}
                    type="button"
                    role="menuitem"
                    aria-label={item.label}
                    $active={item.tool === tool}
                    onClick={() => pickFromMenu(group, item)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Styles.FlyoutItem>
                ))}
              </Styles.Flyout>
            )}
          </Styles.Group>
        )
      })}
      <Styles.Spacer />
      {onHidden && (
        <Styles.ToolButton
          type="button"
          title={hidden ? 'Show all drawings' : 'Hide all drawings'}
          aria-label={hidden ? 'Show all drawings' : 'Hide all drawings'}
          aria-pressed={hidden}
          $active={hidden}
          onClick={() => onHidden(!hidden)}
        >
          <EyeIcon closed={hidden} />
        </Styles.ToolButton>
      )}
      {onLocked && (
        <Styles.ToolButton type="button" title="Lock drawings" aria-label="Lock drawings" aria-pressed={locked} $active={locked} onClick={() => onLocked(!locked)}>
          <LockIcon shut={locked} />
        </Styles.ToolButton>
      )}
      {drawingsList && (
        <Styles.Group>
          <Styles.ToolButton
            type="button"
            title="Drawings list"
            aria-label="Drawings list"
            aria-expanded={open === LIST}
            ref={(element) => {
              triggersRef.current[LIST] = element
            }}
            $active={open === LIST}
            onClick={() => setOpen((current) => (current === LIST ? null : LIST))}
          >
            <ListIcon />
          </Styles.ToolButton>
          {open === LIST && <Styles.Flyout $bottom>{drawingsList}</Styles.Flyout>}
        </Styles.Group>
      )}
    </Styles.Bar>
  )
}
