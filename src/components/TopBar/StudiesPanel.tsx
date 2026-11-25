import {
  BAND_MAX_MULTIPLIER,
  BAND_MIN_MULTIPLIER,
  LEVELS_MAX_PER_SIDE,
  PROFILE_MAX_ROWS,
  PROFILE_MIN_ROWS,
  SMA_MAX_LENGTH,
  SMA_MIN_LENGTH,
} from '../../../shared/limits'
import type { Indicators, PatternKind } from '../../../shared/types'
import { NumberField } from './NumberField'
import * as Styles from './styles'

type StudiesPanelProps = {
  indicators: Indicators
  onIndicators: (indicators: Indicators) => void
}

const PATTERN_KINDS: [PatternKind, string][] = [
  ['doji', 'Doji'],
  ['hammer', 'Hammer'],
  ['shootingStar', 'Shooting star'],
  ['bullishEngulfing', 'Bullish engulfing'],
  ['bearishEngulfing', 'Bearish engulfing'],
]

const MACD_FIELDS = [
  ['fast', 'Fast', 'MACD fast length'],
  ['slow', 'Slow', 'MACD slow length'],
  ['signal', 'Signal', 'MACD signal length'],
] as const

export const StudiesPanel = ({ indicators, onIndicators }: StudiesPanelProps) => {
  const { bollinger, macd, volumeProfile, levels, marks, patterns } = indicators

  const setBollinger = (patch: Partial<Indicators['bollinger']>) =>
    onIndicators({ ...indicators, bollinger: { ...bollinger, ...patch } })

  const setMacd = (patch: Partial<Indicators['macd']>) => onIndicators({ ...indicators, macd: { ...macd, ...patch } })

  const setLevels = (patch: Partial<Indicators['levels']>) => onIndicators({ ...indicators, levels: { ...levels, ...patch } })

  const togglePattern = (kind: PatternKind, on: boolean) =>
    onIndicators({
      ...indicators,
      patterns: { ...patterns, kinds: PATTERN_KINDS.map(([option]) => option).filter((option) => (option === kind ? on : patterns.kinds.includes(option))) },
    })

  const setMarks = (patch: Partial<Indicators['marks']>) => onIndicators({ ...indicators, marks: { ...marks, ...patch } })

  const setProfile = (patch: Partial<Indicators['volumeProfile']>) =>
    onIndicators({ ...indicators, volumeProfile: { ...volumeProfile, ...patch } })

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
        <input type="checkbox" checked={levels.visible} onChange={(event) => setLevels({ visible: event.target.checked })} />
        <Styles.RowLabel>Support & resistance</Styles.RowLabel>
      </Styles.MenuRow>
      {levels.visible && (
        <Styles.MenuItem $indented>
          <Styles.RowLabel>Per side</Styles.RowLabel>
          <NumberField
            label="Levels per side"
            value={levels.perSide}
            min={1}
            max={LEVELS_MAX_PER_SIDE}
            onChange={(perSide) => setLevels({ perSide })}
          />
        </Styles.MenuItem>
      )}
      <Styles.MenuRow>
        <input
          type="checkbox"
          checked={volumeProfile.visible}
          onChange={(event) => setProfile({ visible: event.target.checked })}
        />
        <Styles.RowLabel>Volume profile</Styles.RowLabel>
      </Styles.MenuRow>
      {volumeProfile.visible && (
        <Styles.MenuItem $indented>
          <Styles.RowLabel>Rows</Styles.RowLabel>
          <NumberField
            label="Volume profile rows"
            value={volumeProfile.rows}
            min={PROFILE_MIN_ROWS}
            max={PROFILE_MAX_ROWS}
            onChange={(rows) => setProfile({ rows })}
          />
        </Styles.MenuItem>
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
      <Styles.MenuRow>
        <input
          type="checkbox"
          checked={patterns.visible}
          onChange={(event) => onIndicators({ ...indicators, patterns: { ...patterns, visible: event.target.checked } })}
        />
        <Styles.RowLabel>Candle patterns</Styles.RowLabel>
      </Styles.MenuRow>
      {patterns.visible &&
        PATTERN_KINDS.map(([kind, label]) => (
          <Styles.MenuRow key={kind} $indented>
            <input type="checkbox" checked={patterns.kinds.includes(kind)} onChange={(event) => togglePattern(kind, event.target.checked)} />
            <Styles.RowLabel>{label}</Styles.RowLabel>
          </Styles.MenuRow>
        ))}
      <Styles.MenuSection>Marks</Styles.MenuSection>
      <Styles.MenuRow>
        <input type="checkbox" checked={marks.earnings} onChange={(event) => setMarks({ earnings: event.target.checked })} />
        <Styles.RowLabel>Earnings marks</Styles.RowLabel>
      </Styles.MenuRow>
      <Styles.MenuRow>
        <input type="checkbox" checked={marks.dividends} onChange={(event) => setMarks({ dividends: event.target.checked })} />
        <Styles.RowLabel>Dividend marks</Styles.RowLabel>
      </Styles.MenuRow>
    </>
  )
}
