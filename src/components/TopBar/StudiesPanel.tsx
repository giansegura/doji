import { BAND_MAX_MULTIPLIER, BAND_MIN_MULTIPLIER, SMA_MAX_LENGTH, SMA_MIN_LENGTH } from '../../../shared/limits'
import type { Indicators } from '../../../shared/types'
import { NumberField } from './NumberField'
import * as Styles from './styles'

type StudiesPanelProps = {
  indicators: Indicators
  onIndicators: (indicators: Indicators) => void
}

const MACD_FIELDS = [
  ['fast', 'Fast', 'MACD fast length'],
  ['slow', 'Slow', 'MACD slow length'],
  ['signal', 'Signal', 'MACD signal length'],
] as const

export const StudiesPanel = ({ indicators, onIndicators }: StudiesPanelProps) => {
  const { bollinger, macd } = indicators

  const setBollinger = (patch: Partial<Indicators['bollinger']>) =>
    onIndicators({ ...indicators, bollinger: { ...bollinger, ...patch } })

  const setMacd = (patch: Partial<Indicators['macd']>) => onIndicators({ ...indicators, macd: { ...macd, ...patch } })

  return (
    <>
      <Styles.MenuSection>Studies</Styles.MenuSection>
      <Styles.MenuRow>
        <input type="checkbox" checked={bollinger.visible} onChange={(event) => setBollinger({ visible: event.target.checked })} />
        <Styles.RowLabel>Bollinger Bands</Styles.RowLabel>
      </Styles.MenuRow>
      {bollinger.visible && (
        <>
          <Styles.MenuItem $indented>
            <Styles.RowLabel>Length</Styles.RowLabel>
            <NumberField
              label="Bollinger length"
              value={bollinger.length}
              min={SMA_MIN_LENGTH}
              max={SMA_MAX_LENGTH}
              onChange={(length) => setBollinger({ length })}
            />
          </Styles.MenuItem>
          <Styles.MenuItem $indented>
            <Styles.RowLabel>Multiplier</Styles.RowLabel>
            <NumberField
              label="Bollinger multiplier"
              value={bollinger.multiplier}
              min={BAND_MIN_MULTIPLIER}
              max={BAND_MAX_MULTIPLIER}
              decimal
              onChange={(multiplier) => setBollinger({ multiplier })}
            />
          </Styles.MenuItem>
        </>
      )}
      <Styles.MenuRow>
        <input type="checkbox" checked={macd.visible} onChange={(event) => setMacd({ visible: event.target.checked })} />
        <Styles.RowLabel>MACD</Styles.RowLabel>
      </Styles.MenuRow>
      {macd.visible &&
        MACD_FIELDS.map(([field, title, label]) => (
          <Styles.MenuItem key={field} $indented>
            <Styles.RowLabel>{title}</Styles.RowLabel>
            <NumberField
              label={label}
              value={macd[field]}
              min={SMA_MIN_LENGTH}
              max={SMA_MAX_LENGTH}
              onChange={(length) => setMacd({ [field]: length })}
            />
          </Styles.MenuItem>
        ))}
    </>
  )
}
