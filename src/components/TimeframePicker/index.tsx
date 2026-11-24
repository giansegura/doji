import type { Timeframe } from '../../../shared/types'
import * as Styles from './styles'

type TimeframePickerProps = {
  label: string
  value: Timeframe
  onChange: (timeframe: Timeframe) => void
}

const TIMEFRAMES: Timeframe[] = ['D', 'W', 'M']

export const TimeframePicker = ({ label, value, onChange }: TimeframePickerProps) => (
  <Styles.Group role="group" aria-label={label}>
    {TIMEFRAMES.map((option) => (
      <Styles.Option
        key={option}
        type="button"
        aria-pressed={option === value}
        $active={option === value}
        onClick={() => onChange(option)}
      >
        {option}
      </Styles.Option>
    ))}
  </Styles.Group>
)
