import { isTrend } from '../../../shared/drawings'
import { displaySymbol } from '../../../shared/symbols'
import type { Drawing } from '../../../shared/types'
import { formatPrice } from '../../chart/format'
import * as Styles from './styles'

type DrawingsListProps = { symbol: string; drawings: Drawing[]; onChange: (drawings: Drawing[]) => void }

const nameOf = (drawing: Drawing): string => {
  if (isTrend(drawing)) return drawing.arrow ? 'Arrow' : 'Trend line'
  if (drawing.kind === 'hline') return drawing.from ? 'Horizontal ray' : 'Horizontal line'
  if (drawing.kind === 'vline') return 'Vertical line'
  if (drawing.kind === 'channel') return 'Parallel channel'
  if (drawing.kind === 'rect') return 'Rectangle'
  if (drawing.kind === 'zone') return 'Zone'
  if (drawing.kind === 'note') return 'Text'
  return drawing.side === 'long' ? 'Long position' : 'Short position'
}

const levelOf = (drawing: Drawing, symbol: string): string => {
  const price = (value: number) => formatPrice(value, symbol)
  if (drawing.kind === 'hline') return drawing.from ? `${price(drawing.value)} from ${drawing.from}` : price(drawing.value)
  if (drawing.kind === 'vline') return drawing.date
  if (drawing.kind === 'zone') return `${price(drawing.bottom)} – ${price(drawing.top)}`
  if (drawing.kind === 'note') return `${drawing.p1.date} · ${price(drawing.p1.value)}`
  if (drawing.kind === 'position') return `entry ${price(drawing.p1.value)}`
  return `${price(drawing.p1.value)} → ${price(drawing.p2.value)}`
}

const textOf = (drawing: Drawing): string | null => ('text' in drawing && drawing.text ? drawing.text : null)

const toggled = (drawing: Drawing): Drawing => {
  if (!drawing.hidden) return { ...drawing, hidden: true }
  const { hidden: _hidden, ...shown } = drawing
  return shown as Drawing
}

const EyeIcon = ({ closed }: { closed: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="1.8" />
    {closed && <path d="M2.5 13.5l11-11" strokeLinecap="round" />}
  </svg>
)

export const DrawingsList = ({ symbol, drawings, onChange }: DrawingsListProps) => (
  <Styles.Panel>
    <Styles.Title>{`Drawings on ${displaySymbol(symbol)}`}</Styles.Title>
    {drawings.length === 0 ? (
      <Styles.Note>{`No drawings on ${displaySymbol(symbol)}`}</Styles.Note>
    ) : (
      <Styles.List>
        {drawings.map((drawing) => {
          const name = nameOf(drawing)
          const level = levelOf(drawing, symbol)
          const label = `${name} ${level}`
          const text = textOf(drawing)
          const tags = [drawing.pane === 'rsi' ? 'RSI' : null, drawing.currency ? 'EUR' : null].filter(Boolean).join(' · ')
          return (
            <Styles.Item key={drawing.id} $hidden={drawing.hidden === true}>
              <Styles.Swatch $color={drawing.color} />
              <Styles.Text>
                <Styles.Name>{[name, text].filter(Boolean).join(' · ')}</Styles.Name>
                <Styles.Detail>{[level, tags].filter(Boolean).join(' · ')}</Styles.Detail>
              </Styles.Text>
              <Styles.Action
                type="button"
                aria-label={`${drawing.hidden ? 'Show' : 'Hide'} ${label}`}
                title={drawing.hidden ? 'Show' : 'Hide'}
                onClick={() => onChange(drawings.map((other) => (other.id === drawing.id ? toggled(other) : other)))}
              >
                <EyeIcon closed={drawing.hidden === true} />
              </Styles.Action>
              <Styles.Action
                type="button"
                aria-label={`Delete ${label}`}
                title="Delete"
                onClick={() => onChange(drawings.filter((other) => other.id !== drawing.id))}
              >
                ×
              </Styles.Action>
            </Styles.Item>
          )
        })}
      </Styles.List>
    )}
  </Styles.Panel>
)
