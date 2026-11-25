import { type FormEvent, useState } from 'react'
import { RANGE_KEYS, type RangeKey } from './rangeButtons'
import * as Styles from './styles'

type RangeBarProps = { onRange: (key: RangeKey) => void; onGoTo: (date: string) => void }

const NAMES: Record<RangeKey, string> = {
  '1M': '1 month',
  '3M': '3 months',
  '6M': '6 months',
  YTD: 'year to date',
  '1Y': '1 year',
  '5Y': '5 years',
  All: 'all',
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

export const RangeBar = ({ onRange, onGoTo }: RangeBarProps) => {
  const [date, setDate] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (DATE.test(date)) onGoTo(date)
  }

  return (
    <Styles.RangeBar>
      {RANGE_KEYS.map((key) => (
        <Styles.RangeButton key={key} type="button" aria-label={`Show ${NAMES[key]}`} title={`Show ${NAMES[key]}`} onClick={() => onRange(key)}>
          {key}
        </Styles.RangeButton>
      ))}
      <Styles.RangeDivider />
      <Styles.GoTo onSubmit={handleSubmit}>
        <Styles.GoToField type="date" aria-label="Go to date" title="Go to date" value={date} onChange={(event) => setDate(event.target.value)} />
        <button type="submit" hidden aria-hidden="true" />
      </Styles.GoTo>
    </Styles.RangeBar>
  )
}
