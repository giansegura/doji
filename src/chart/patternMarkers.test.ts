import { expect, test } from 'vitest'
import { patternMarkers } from './patternMarkers'

const bars = [{ time: '2026-11-02' }, { time: '2026-11-03' }, { time: '2026-11-04' }]
const colors = { up: '#0f0', down: '#f00', neutral: '#999' }

test('Should mark bullish patterns below the bar, bearish ones above and dojis above in a neutral colour', () => {
  expect(
    patternMarkers(
      [
        { index: 0, kind: 'hammer' },
        { index: 1, kind: 'bearishEngulfing' },
        { index: 2, kind: 'doji' },
      ],
      bars,
      colors,
    ),
  ).toEqual([
    { time: '2026-11-02', position: 'belowBar', shape: 'arrowUp', color: '#0f0', text: 'Hammer', size: 1 },
    { time: '2026-11-03', position: 'aboveBar', shape: 'arrowDown', color: '#f00', text: 'Engulfing', size: 1 },
    { time: '2026-11-04', position: 'aboveBar', shape: 'circle', color: '#999', text: 'Doji', size: 0.6 },
  ])
})
