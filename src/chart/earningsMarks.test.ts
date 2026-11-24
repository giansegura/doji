import { expect, test } from 'vitest'
import { earningsMarks, nextEarningsLabel } from './earningsMarks'
import { createEarningsPrimitive } from './earningsPrimitive'
import { createTimeIndex } from './timeIndex'

const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10']
const daily = createTimeIndex(days, 'D')
const toX = (index: number) => 100 + index * 10

test('Should place each past report and the next one on the bar of its day', () => {
  const marks = earningsMarks({ past: ['2026-11-04'], next: '2026-11-12', nextIsEstimate: false }, daily, toX, 400)
  expect(marks).toEqual([
    { x: 120, kind: 'past' },
    { x: 180, kind: 'next' },
  ])
})

test('Should leave out the reports that fall outside the pane', () => {
  expect(earningsMarks({ past: ['2026-11-04'], next: '2027-06-01', nextIsEstimate: false }, daily, toX, 200)).toEqual([
    { x: 120, kind: 'past' },
  ])
})

test('Should place a report on the bar of its week on a weekly chart', () => {
  const weekly = createTimeIndex(['2026-10-26', '2026-11-02', '2026-11-09'], 'W')
  expect(earningsMarks({ past: ['2026-11-05'], next: null, nextIsEstimate: false }, weekly, toX, 400)).toEqual([{ x: 110, kind: 'past' }])
})

test('Should tell when the next report comes and whether its date is only an estimate', () => {
  expect(nextEarningsLabel({ past: [], next: '2027-01-28', nextIsEstimate: false })).toBe('Earnings Jan 28, 2027')
  expect(nextEarningsLabel({ past: [], next: '2027-01-28', nextIsEstimate: true })).toBe('Earnings ~Jan 28, 2027')
  expect(nextEarningsLabel({ past: ['2026-11-02'], next: null, nextIsEstimate: false })).toBeNull()
})

test('Should paint a filled mark for a past report and a hollow one for the next, near the bottom of the pane', () => {
  const calls: string[] = []
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    beginPath: () => undefined,
    arc: (x: number, y: number, radius: number) => calls.push(`arc ${x},${y} r${radius}`),
    fill: () => calls.push(`fill ${context.fillStyle}`),
    stroke: () => calls.push(`stroke ${context.strokeStyle}`),
    fillText: (text: string, x: number, y: number) => calls.push(`text ${text} ${x},${y} ${context.fillStyle}`),
    save: () => undefined,
    restore: () => undefined,
  }
  const primitive = createEarningsPrimitive({
    marks: () => [
      { x: 120, kind: 'past' },
      { x: 180, kind: 'next' },
    ],
    colors: () => ({ past: '#8F897E', next: '#7C5CFF', background: '#151412', text: '#151412' }),
  })
  primitive.paneViews?.()[0].renderer()?.draw({
    useMediaCoordinateSpace: (callback: (scope: unknown) => void) => callback({ context, mediaSize: { width: 400, height: 300 } }),
  } as never)
  expect(calls).toEqual([
    'arc 120,290 r7',
    'fill #8F897E',
    'text E 120,290 #151412',
    'arc 180,290 r7',
    'fill #151412',
    'stroke #7C5CFF',
    'text E 180,290 #7C5CFF',
  ])
})
