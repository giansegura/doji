import { expect, test } from 'vitest'
import { createProfileMemo, visibleBars } from './useVolumeProfile'
import { profileLayout, volumeProfile } from './volumeProfile'

const bar = (low: number, high: number, volume: number, up = true) => ({
  open: up ? low : high,
  close: up ? high : low,
  high,
  low,
  volume,
})

test('Should spread the volume of each bar over the rows it covers, apart for rising and falling bars', () => {
  const profile = volumeProfile([bar(100, 104, 400), bar(102, 104, 200, false)], 4)
  expect(profile?.rows).toEqual([
    { low: 100, high: 101, up: 100, down: 0 },
    { low: 101, high: 102, up: 100, down: 0 },
    { low: 102, high: 103, up: 100, down: 100 },
    { low: 103, high: 104, up: 100, down: 100 },
  ])
})

test('Should put the whole volume of a bar without range in the row of its price', () => {
  const profile = volumeProfile([bar(100, 104, 400), bar(101.5, 101.5, 50)], 4)
  expect(profile?.rows[1]).toEqual({ low: 101, high: 102, up: 150, down: 0 })
})

test('Should point at the row that traded the most and the rows that hold seventy percent of the volume', () => {
  const bars = [bar(100, 110, 100), bar(104, 106, 400), bar(103, 107, 200), bar(108, 110, 100)]
  const profile = volumeProfile(bars, 10)
  expect(profile?.poc).toBe(4)
  expect(profile?.valueArea).toEqual({ from: 4, to: 6 })
})

test('Should keep a profile when every bar traded at one price', () => {
  const profile = volumeProfile([bar(100, 100, 500)], 4)
  expect(profile).not.toBeNull()
  expect(profile?.rows.reduce((sum, row) => sum + row.up + row.down, 0)).toBe(500)
  const busiest = profile?.rows[profile.poc]
  expect(busiest && busiest.low <= 100 && busiest.high >= 100).toBe(true)
})

test('Should give no profile without volume or without bars', () => {
  expect(volumeProfile([bar(100, 104, 0)], 4)).toBeNull()
  expect(volumeProfile([], 4)).toBeNull()
})

test('Should lay the rows against the right edge, wider where more traded and brighter inside the value area', () => {
  const profile = {
    rows: [
      { low: 100, high: 101, up: 30, down: 10 },
      { low: 101, high: 102, up: 60, down: 20 },
      { low: 102, high: 103, up: 0, down: 20 },
    ],
    poc: 1,
    valueArea: { from: 0, to: 1 },
  }
  const toY = (price: number) => 400 - (price - 100) * 100
  const layout = profileLayout(profile, toY, 1000)
  expect(layout.boxes).toEqual([
    { x: 875, y: 301, width: 93.75, height: 98, side: 'up', inside: true },
    { x: 968.75, y: 301, width: 31.25, height: 98, side: 'down', inside: true },
    { x: 750, y: 201, width: 187.5, height: 98, side: 'up', inside: true },
    { x: 937.5, y: 201, width: 62.5, height: 98, side: 'down', inside: true },
    { x: 937.5, y: 101, width: 62.5, height: 98, side: 'down', inside: false },
  ])
  expect(layout.poc).toBe(250)
})

test('Should take only the bars inside the visible range', () => {
  const bars = Array.from({ length: 10 }, (_, index) => ({ time: `2026-01-${String(index + 1).padStart(2, '0')}`, open: 1, high: 2, low: 1, close: 2, volume: 1 }))
  expect(visibleBars(bars, { from: 2.5, to: 5.4 }).map((item) => item.time)).toEqual(['2026-01-04', '2026-01-05', '2026-01-06'])
  expect(visibleBars(bars, { from: -3, to: 1 }).map((item) => item.time)).toEqual(['2026-01-01', '2026-01-02'])
  expect(visibleBars(bars, null)).toEqual([])
})

test('Should work the profile out again when the bars change, even if only a volume did', () => {
  const memo = createProfileMemo()
  const bars = [{ time: '2026-11-23', ...bar(100, 104, 400) }]
  const range = { from: 0, to: 0 }
  const first = memo(bars, range, 4)
  expect(memo(bars, range, 4)).toBe(first)
  const louder = [{ ...bars[0], volume: 800 }]
  expect(memo(louder, range, 4)?.rows[0].up).toBe(200)
})
