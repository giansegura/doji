import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { LINE_TEXT_MAX_LENGTH, MIN_LINE_OPACITY } from '../../shared/limits'
import { isTrend } from '../../shared/drawings'
import type { Drawing, LineStyle, Position, TrendLine } from '../../shared/types'
import { LINE_COLORS } from '../theme/tokens'
import * as Styles from './styles'

type LineToolbarProps = {
  line: Drawing
  onChange: (line: Drawing) => void
  onDelete: () => void
  onArm?: () => void
}

const WIDTHS = [1, 2, 3, 4]
const FULL = 100
const OPACITY_STEP = 5

const STROKES: { style: LineStyle; label: string; dash?: string }[] = [
  { style: 'solid', label: 'Solid line' },
  { style: 'dashed', label: 'Dashed line', dash: '4 3' },
  { style: 'dotted', label: 'Dotted line', dash: '1.5 2.5' },
]

const withStroke = (line: Drawing, style: LineStyle): Drawing => {
  const { lineStyle: _old, ...rest } = line
  return (style === 'solid' ? rest : { ...rest, lineStyle: style }) as Drawing
}

const withOpacity = (line: Drawing, percent: number): Drawing => {
  const { opacity: _old, ...rest } = line
  return (percent >= FULL ? rest : { ...rest, opacity: percent / FULL }) as Drawing
}

const withPriceShown = (line: Drawing, shown: boolean): Drawing => {
  if (line.kind !== 'hline') return line
  const { hidePrice: _old, ...rest } = line
  return shown ? rest : { ...rest, hidePrice: true as const }
}

const takesText = (line: Drawing): boolean =>
  line.kind === undefined || line.kind === 'trend' || line.kind === 'hline' || line.kind === 'note' || line.kind === 'zone' || line.kind === 'vline'

const withText = (line: Drawing, text: string): Drawing => {
  if (!takesText(line)) return line
  if (line.kind === 'note') return text ? { ...line, text } : line
  const { text: _old, ...rest } = line as Exclude<Drawing, { kind: 'note' }> & { text?: string }
  return (text ? { ...rest, text } : rest) as Drawing
}

const withArrow = (line: TrendLine, on: boolean): Drawing => {
  const { arrow: _old, ...rest } = line
  return on ? { ...rest, arrow: true } : rest
}

type DraftFieldProps = {
  label: string
  placeholder: string
  saved: string
  maxLength?: number
  narrow?: boolean
  onCommit: (text: string) => boolean
}

const DraftField = ({ label, placeholder, saved, maxLength, narrow = false, onCommit }: DraftFieldProps) => {
  const [draft, setDraft] = useState(saved)
  const fieldRef = useRef<HTMLInputElement>(null)
  const saveRef = useRef<() => void>(() => undefined)
  const sentRef = useRef(saved)
  const editedRef = useRef(false)

  const save = () => {
    if (!editedRef.current) return
    editedRef.current = false
    const text = draft.trim()
    if (text === sentRef.current) return
    if (!onCommit(text)) {
      setDraft(sentRef.current)
      return
    }
    sentRef.current = text
  }

  useEffect(() => {
    saveRef.current = save
  })

  useEffect(() => {
    sentRef.current = saved
    if (!editedRef.current) setDraft(saved)
  }, [saved])

  useEffect(() => {
    const saveOnPressElsewhere = (event: PointerEvent) => {
      if (event.target !== fieldRef.current) saveRef.current()
    }
    window.addEventListener('pointerdown', saveOnPressElsewhere, true)
    return () => window.removeEventListener('pointerdown', saveOnPressElsewhere, true)
  }, [])

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
    if (event.key !== 'Escape') return
    editedRef.current = false
    setDraft(saved)
  }

  return (
    <Styles.LineText
      ref={fieldRef}
      type="text"
      aria-label={label}
      title={label}
      placeholder={placeholder}
      maxLength={maxLength}
      $narrow={narrow}
      value={draft}
      onChange={(event) => {
        editedRef.current = true
        setDraft(event.target.value)
      }}
      onBlur={save}
      onKeyDown={handleKey}
    />
  )
}

const LineTextField = ({ line, onChange }: { line: Drawing; onChange: (line: Drawing) => void }) => (
  <DraftField
    label="Text on the line"
    placeholder="Text"
    saved={'text' in line ? (line.text ?? '') : ''}
    maxLength={LINE_TEXT_MAX_LENGTH}
    onCommit={(text) => {
      if (line.kind === 'note' && text === '') return false
      const next = withText(line, text)
      if (next !== line) onChange(next)
      return true
    }}
  />
)

type Sizing = 'account' | 'riskPercent'

const SIZING_LIMITS: Record<Sizing, number> = { account: Number.POSITIVE_INFINITY, riskPercent: 100 }

const withSizing = (position: Position, field: Sizing, text: string): Position | null => {
  const { [field]: _old, ...rest } = position
  if (text === '') return rest as Position
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 && value <= SIZING_LIMITS[field] ? { ...rest, [field]: value } : null
}

const SizingField = ({ position, field, label, placeholder, onChange }: { position: Position; field: Sizing; label: string; placeholder: string; onChange: (line: Drawing) => void }) => (
  <DraftField
    label={label}
    placeholder={placeholder}
    saved={position[field] === undefined ? '' : String(position[field])}
    narrow
    onCommit={(text) => {
      const sized = withSizing(position, field, text)
      if (sized) onChange(sized)
      return sized !== null
    }}
  />
)

const StrokeIcon = ({ dash }: { dash?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M3 10h14" strokeDasharray={dash} />
  </svg>
)

const PriceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M2.5 10h6" strokeLinecap="round" />
    <path d="M10 6.5h5.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H10L8 10l2-3.5z" strokeLinejoin="round" />
  </svg>
)

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

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M3.5 14.5L14 4M14 4H9M14 4v5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M3.5 5h11M7 5V3.5h4V5M5 5l.6 9.5h6.8L13 5M7.5 7.5v4.5M10.5 7.5v4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const StylePanel = ({ line, onChange }: { line: Drawing; onChange: (line: Drawing) => void }) => {
  const stroke = line.lineStyle ?? 'solid'
  const opacity = Math.round((line.opacity ?? 1) * FULL)

  return (
    <Styles.StylePanel role="group" aria-label="Line style">
      <Styles.StyleRow>
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
      </Styles.StyleRow>
      <Styles.StyleRow>
        {STROKES.map(({ style, label, dash }) => (
          <Styles.ToolbarButton
            key={style}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={stroke === style}
            onClick={() => onChange(withStroke(line, style))}
          >
            <StrokeIcon dash={dash} />
          </Styles.ToolbarButton>
        ))}
      </Styles.StyleRow>
      {isTrend(line) && (
        <Styles.StyleRow>
          <Styles.ToolbarButton type="button" title="Arrow" aria-label="Arrow" aria-pressed={line.arrow === true} onClick={() => onChange(withArrow(line, !line.arrow))}>
            <ArrowIcon />
          </Styles.ToolbarButton>
        </Styles.StyleRow>
      )}
      <Styles.StyleRow>
        <Styles.OpacitySlider
          type="range"
          aria-label="Opacity"
          title="Opacity"
          min={MIN_LINE_OPACITY * FULL}
          max={FULL}
          step={OPACITY_STEP}
          value={opacity}
          onChange={(event) => onChange(withOpacity(line, Number(event.target.value)))}
        />
        <Styles.OpacityValue aria-hidden="true">{`${opacity}%`}</Styles.OpacityValue>
      </Styles.StyleRow>
    </Styles.StylePanel>
  )
}

export const LineToolbar = ({ line, onChange, onDelete, onArm }: LineToolbarProps) => {
  const [styling, setStyling] = useState(false)
  const dash = STROKES.find(({ style }) => style === (line.lineStyle ?? 'solid'))?.dash

  return (
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
      <Styles.StyleAnchor>
        <Styles.ToolbarButton
          type="button"
          title="Width, stroke and opacity"
          aria-label="Line style"
          aria-expanded={styling}
          onClick={() => setStyling((open) => !open)}
        >
          <StrokeIcon dash={dash} />
        </Styles.ToolbarButton>
        {styling && <StylePanel line={line} onChange={onChange} />}
      </Styles.StyleAnchor>
      <Styles.ToolbarDivider />
      {takesText(line) && <LineTextField key={line.id} line={line} onChange={onChange} />}
      {line.kind === 'position' && (
        <>
          <SizingField key={`${line.id}-account`} position={line} field="account" label="Account size" placeholder="Account" onChange={onChange} />
          <SizingField key={`${line.id}-risk`} position={line} field="riskPercent" label="Risk %" placeholder="Risk %" onChange={onChange} />
        </>
      )}
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
      {line.pane === 'price' && !line.currency && (line.kind === undefined || line.kind === 'trend' || line.kind === 'hline' || line.kind === 'position') && (
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
      {line.kind === 'hline' && (
        <Styles.ToolbarButton
          type="button"
          title="Show the price on the axis"
          aria-label="Price on the axis"
          aria-pressed={!line.hidePrice}
          onClick={() => onChange(withPriceShown(line, line.hidePrice === true))}
        >
          <PriceIcon />
        </Styles.ToolbarButton>
      )}
      <Styles.ToolbarButton type="button" title="Delete line" aria-label="Delete line" onClick={onDelete}>
        <TrashIcon />
      </Styles.ToolbarButton>
    </Styles.Toolbar>
  )
}
