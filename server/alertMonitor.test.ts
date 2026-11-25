import { expect, test } from 'vitest'
import { type AlertEvent, type AppState, DEFAULT_STATE, type Drawing, type LiveTick, type Quote } from '../shared/types'
import { createAlertMonitor } from './alertMonitor'
import type { SaveOutcome } from './stateStore'

const level = (id: string, value: number, over: Partial<Drawing> = {}): Drawing =>
  ({ id, kind: 'hline', pane: 'price', timeframe: 'D', value, color: '#FFFFFF', width: 1, pricedAt: '2020-01-01', alert: true, ...over }) as Drawing

const stateWith = (lines: Record<string, Drawing[]>, rev = 5): AppState => ({ ...DEFAULT_STATE, rev, lines })

const tick = (symbol: string, price: number): LiveTick => ({ symbol, price, change: 0, changePercent: 0, time: 1, session: 'regular', volume: null })

const harness = (initial: AppState, over: { conflicts?: number; quotes?: Quote[]; failures?: number } = {}) => {
  const box = {
    state: initial,
    saves: 0,
    conflicts: over.conflicts ?? 0,
    failures: over.failures ?? 0,
    joined: [] as string[][],
    left: 0,
    send: null as ((ticks: LiveTick[]) => void) | null,
    announced: [] as AlertEvent[],
    poll: null as (() => void) | null,
    quotesAsked: [] as string[][],
  }
  let counter = 0
  const monitor = createAlertMonitor({
    read: async () => box.state,
    save: async (state, baseRev): Promise<SaveOutcome> => {
      box.saves += 1
      if (box.failures > 0) {
        box.failures -= 1
        throw new Error('disk full')
      }
      if (box.conflicts > 0) {
        box.conflicts -= 1
        box.state = { ...box.state, rev: box.state.rev + 1 }
        return { ok: false, reason: 'conflict' }
      }
      if (baseRev !== box.state.rev) return { ok: false, reason: 'conflict' }
      box.state = { ...state, rev: baseRev + 1 }
      return { ok: true, rev: baseRev + 1 }
    },
    join: (symbols, send) => {
      box.joined.push(symbols)
      box.send = send
      return () => {
        box.left += 1
      }
    },
    quotes: async (symbols) => {
      box.quotesAsked.push(symbols)
      return over.quotes ?? []
    },
    announce: (alerts) => {
      box.announced.push(...alerts)
    },
    now: () => new Date('2026-11-24T15:00:00Z'),
    every: (run) => {
      box.poll = run
      return () => undefined
    },
    newId: () => {
      counter += 1
      return `a${counter}`
    },
  })
  return { box, monitor }
}

test('Should listen to the live prices of the symbols with an armed drawing only', async () => {
  const { box, monitor } = harness(stateWith({ KO: [level('k', 100)], PEP: [level('p', 50, { alert: false })] }))
  await monitor.start()
  expect(box.joined).toEqual([['KO']])
})

test('Should fire when a live price crosses an armed line, disarm it in the saved state and announce it with its text', async () => {
  const { box, monitor } = harness(stateWith({ KO: [level('k', 100, { text: 'R1' } as Partial<Drawing>)] }))
  await monitor.start()
  box.send?.([tick('KO', 99)])
  await monitor.settled()
  box.send?.([tick('KO', 101)])
  await monitor.settled()
  expect(box.announced).toEqual([
    { id: 'a1', symbol: 'KO', level: 100, price: 101, direction: 'up', at: '2026-11-24T15:00:00.000Z', text: 'R1' },
  ])
  expect(box.state.lines.KO[0]).not.toHaveProperty('alert')
  expect(box.state.rev).toBe(6)
  box.send?.([tick('KO', 99)])
  box.send?.([tick('KO', 102)])
  await monitor.settled()
  expect(box.announced).toHaveLength(1)
  expect(box.left).toBe(1)
})

test('Should also check the armed symbols every so often with their latest quote, outside regular hours too', async () => {
  const quotes: Quote[] = [{ symbol: 'KO', price: 99, change: 0, changePercent: 0, extended: null }]
  const { box, monitor } = harness(stateWith({ KO: [level('k', 100)] }), { quotes })
  await monitor.start()
  box.poll?.()
  await monitor.settled()
  quotes[0] = { ...quotes[0], extended: { session: 'post', price: 100.5, changePercent: 1.5 } }
  box.poll?.()
  await monitor.settled()
  expect(box.quotesAsked).toEqual([['KO'], ['KO']])
  expect(box.announced.map((alert) => [alert.price, alert.direction])).toEqual([[100.5, 'up']])
})

test('Should disarm on top of a change saved meanwhile', async () => {
  const { box, monitor } = harness(stateWith({ KO: [level('k', 100)] }), { conflicts: 1 })
  await monitor.start()
  box.send?.([tick('KO', 99)])
  box.send?.([tick('KO', 101)])
  await monitor.settled()
  expect(box.saves).toBe(2)
  expect(box.state.lines.KO[0]).not.toHaveProperty('alert')
})

test('Should follow the symbols armed after a save of the state', async () => {
  const { box, monitor } = harness(stateWith({}))
  await monitor.start()
  expect(box.joined).toEqual([])
  monitor.stateSaved(stateWith({ AAPL: [level('a', 300)] }, 6))
  expect(box.joined).toEqual([['AAPL']])
  monitor.stateSaved(stateWith({ AAPL: [level('a', 300)] }, 7))
  expect(box.joined).toHaveLength(1)
})

test('Should still announce an alert when saving its disarm keeps failing', async () => {
  const { box, monitor } = harness(stateWith({ KO: [level('k', 100)] }), { failures: 10 })
  await monitor.start()
  box.send?.([tick('KO', 99)])
  await monitor.settled()
  box.send?.([tick('KO', 101)])
  await monitor.settled()
  expect(box.announced.map((alert) => alert.level)).toEqual([100])
  expect(box.state.lines.KO[0]).toHaveProperty('alert', true)
})

test('Should disarm after a failed save once a later attempt works', async () => {
  const { box, monitor } = harness(stateWith({ KO: [level('k', 100)] }), { failures: 1 })
  await monitor.start()
  box.send?.([tick('KO', 99)])
  await monitor.settled()
  box.send?.([tick('KO', 101)])
  await monitor.settled()
  expect(box.state.lines.KO[0]).not.toHaveProperty('alert')
})

test('Should leave armed a line moved to another level while its old level fired', async () => {
  const { box, monitor } = harness(stateWith({ KO: [level('k', 100)] }))
  await monitor.start()
  box.send?.([tick('KO', 99)])
  await monitor.settled()
  box.state = stateWith({ KO: [level('k', 120)] }, 6)
  box.send?.([tick('KO', 101)])
  await monitor.settled()
  expect(box.announced.map((alert) => alert.level)).toEqual([100])
  expect(box.state.lines.KO[0]).toMatchObject({ value: 120, alert: true })
})
