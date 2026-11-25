import { type FormEvent, useState } from 'react'
import { indicatorLabel } from '../../../shared/indicatorAlerts'
import { displaySymbol } from '../../../shared/symbols'
import type { IndicatorAlert, IndicatorAlertKind, SmaConfig } from '../../../shared/types'
import * as Styles from './styles'

type Draft = Omit<IndicatorAlert, 'id'>

type IndicatorAlertsProps = {
  symbol: string
  alerts: IndicatorAlert[]
  averages: SmaConfig[]
  onAdd: (alert: Draft) => void
  onArm: (id: string, armed: boolean) => void
  onRemove: (id: string) => void
}

const CONDITIONS: [IndicatorAlertKind, string][] = [
  ['rsi', 'RSI 14 crosses'],
  ['average', 'Price crosses average'],
  ['move', 'Day move beyond %'],
]

const DEFAULT_VALUES: Record<IndicatorAlertKind, string> = { rsi: '30', average: '0', move: '3' }

const averageName = (config: SmaConfig): string => `${config.kind === 'ema' ? 'EMA' : 'SMA'} ${config.length}`

export const IndicatorAlerts = ({ symbol, alerts, averages, onAdd, onArm, onRemove }: IndicatorAlertsProps) => {
  const [kind, setKind] = useState<IndicatorAlertKind>('rsi')
  const [value, setValue] = useState(DEFAULT_VALUES.rsi)
  const [averageId, setAverageId] = useState(averages[0]?.id ?? '')
  const number = Number(value)
  const needsAverage = kind === 'average'
  const chosenAverage = averages.some((average) => average.id === averageId) ? averageId : (averages[0]?.id ?? '')
  const ready = needsAverage ? chosenAverage !== '' : value.trim() !== '' && Number.isFinite(number) && number > 0

  const choose = (next: IndicatorAlertKind) => {
    setKind(next)
    setValue(DEFAULT_VALUES[next])
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    onAdd(needsAverage ? { kind, value: 0, averageId: chosenAverage, armed: true } : { kind, value: number, armed: true })
  }

  return (
    <Styles.Panel>
      <Styles.Title>{`Alerts for ${displaySymbol(symbol)}`}</Styles.Title>
      {alerts.length === 0 ? (
        <Styles.Note>{`No alerts for ${displaySymbol(symbol)} yet`}</Styles.Note>
      ) : (
        <Styles.List>
          {alerts.map((alert) => {
            const label = indicatorLabel(alert, averages)
            return (
              <Styles.Item key={alert.id}>
                <Styles.ItemLabel>
                  <input type="checkbox" checked={alert.armed} onChange={(event) => onArm(alert.id, event.target.checked)} />
                  {label}
                </Styles.ItemLabel>
                <Styles.Remove type="button" aria-label={`Remove alert ${label}`} title="Remove alert" onClick={() => onRemove(alert.id)}>
                  ×
                </Styles.Remove>
              </Styles.Item>
            )
          })}
        </Styles.List>
      )}
      <Styles.Form onSubmit={handleSubmit}>
        <Styles.Select aria-label="Condition" value={kind} onChange={(event) => choose(event.target.value as IndicatorAlertKind)}>
          {CONDITIONS.map(([option, label]) => (
            <option key={option} value={option}>
              {label}
            </option>
          ))}
        </Styles.Select>
        {needsAverage && averages.length > 0 && (
          <Styles.Select aria-label="Average" value={chosenAverage} onChange={(event) => setAverageId(event.target.value)}>
            {averages.map((average) => (
              <option key={average.id} value={average.id}>
                {averageName(average)}
              </option>
            ))}
          </Styles.Select>
        )}
        {!needsAverage && (
          <Styles.Input aria-label="Value" type="number" min="0" step="any" value={value} onChange={(event) => setValue(event.target.value)} />
        )}
        <Styles.Add type="submit" disabled={!ready}>
          Add alert
        </Styles.Add>
        {needsAverage && averages.length === 0 && <Styles.Note>Add a moving average first</Styles.Note>}
      </Styles.Form>
    </Styles.Panel>
  )
}
