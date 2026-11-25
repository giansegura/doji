import type { SeriesMarker, Time } from 'lightweight-charts'
import type { Bar, PatternKind } from '../../shared/types'
import type { FoundPattern } from '../domain/patterns'

type Colors = { up: string; down: string; neutral: string }

const LOOKS: Record<PatternKind, { text: string; side: 'up' | 'down' | 'neutral' }> = {
  hammer: { text: 'Hammer', side: 'up' },
  bullishEngulfing: { text: 'Engulfing', side: 'up' },
  shootingStar: { text: 'Star', side: 'down' },
  bearishEngulfing: { text: 'Engulfing', side: 'down' },
  doji: { text: 'Doji', side: 'neutral' },
}

const NEUTRAL_SIZE = 0.6

export const patternMarkers = (found: FoundPattern[], bars: Pick<Bar, 'time'>[], colors: Colors): SeriesMarker<Time>[] =>
  found.flatMap(({ index, kind }): SeriesMarker<Time>[] => {
    const bar = bars[index]
    if (!bar) return []
    const look = LOOKS[kind]
    if (look.side === 'neutral') {
      return [{ time: bar.time as Time, position: 'aboveBar', shape: 'circle', color: colors.neutral, text: look.text, size: NEUTRAL_SIZE }]
    }
    const up = look.side === 'up'
    return [
      {
        time: bar.time as Time,
        position: up ? 'belowBar' : 'aboveBar',
        shape: up ? 'arrowUp' : 'arrowDown',
        color: up ? colors.up : colors.down,
        text: look.text,
        size: 1,
      },
    ]
  })
