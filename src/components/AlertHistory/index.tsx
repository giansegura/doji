import { useTheme } from 'styled-components'
import { displaySymbol } from '../../../shared/symbols'
import type { AlertEvent } from '../../../shared/types'
import { formatPrice } from '../../chart/format'
import * as Styles from './styles'

type AlertHistoryProps = { events: AlertEvent[]; onPick: (symbol: string) => void; onClear: () => void }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const twoDigits = (value: number): string => String(value).padStart(2, '0')

const whenOf = (at: string): string => {
  const date = new Date(at)
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
}

const whatOf = (event: AlertEvent): string => event.label ?? `Crossed ${formatPrice(event.level, event.symbol)}`

const Entry = ({ event, onPick }: { event: AlertEvent; onPick: (symbol: string) => void }) => {
  const theme = useTheme()
  const up = event.direction === 'up'
  return (
    <li>
      <Styles.Entry
        type="button"
        aria-label={`${displaySymbol(event.symbol)} ${whatOf(event)} going ${event.direction}, at ${formatPrice(event.price, event.symbol)}, ${whenOf(event.at)}`}
        title={event.text ?? undefined}
        onClick={() => onPick(event.symbol)}
      >
        <Styles.When>{whenOf(event.at)}</Styles.When>
        <Styles.Code>{displaySymbol(event.symbol)}</Styles.Code>
        <Styles.What>
          {`${whatOf(event)} `}
          <Styles.Arrow $color={up ? theme.ui.up : theme.ui.down}>{up ? '▲' : '▼'}</Styles.Arrow>
        </Styles.What>
        <Styles.Price>{formatPrice(event.price, event.symbol)}</Styles.Price>
      </Styles.Entry>
    </li>
  )
}

export const AlertHistory = ({ events, onPick, onClear }: AlertHistoryProps) => (
  <Styles.Panel>
    <Styles.Header>
      <Styles.Title>History</Styles.Title>
      {events.length > 0 && (
        <Styles.Clear type="button" aria-label="Clear history" onClick={onClear}>
          Clear
        </Styles.Clear>
      )}
    </Styles.Header>
    {events.length === 0 ? (
      <Styles.Note>No alert has gone off yet</Styles.Note>
    ) : (
      <Styles.List aria-label="Alert history">
        {events.map((event) => (
          <Entry key={event.id} event={event} onPick={onPick} />
        ))}
      </Styles.List>
    )}
  </Styles.Panel>
)
