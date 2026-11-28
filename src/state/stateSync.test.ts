import { expect, test } from 'vitest'
import { type AppState, DEFAULT_STATE } from '../../shared/types'
import { type SaveLink, type SaveResult, createStateSync } from './stateSync'

type Timer = { run: () => void; ms: number; cancelled: boolean }

type Put = { state: AppState; keepalive: boolean; saved: AppState | null; link: SaveLink; resolve: (result: SaveResult) => void }

const state = (symbol: string, rev = 4): AppState => ({ ...DEFAULT_STATE, symbol, rev })

const makeSync = () => {
  const timers: Timer[] = []
  const puts: Put[] = []
  const events: string[] = []
  const sync = createStateSync({
    put: (sent, keepalive, saved, link) =>
      new Promise<SaveResult>((resolve) => puts.push({ state: sent, keepalive, saved, link, resolve })),
    onSaved: () => events.push('saved'),
    onConflict: () => events.push('conflict'),
    onFailed: () => events.push('failed'),
    setTimer: (run, ms) => {
      const timer = { run, ms, cancelled: false }
      timers.push(timer)
      return timer
    },
    clearTimer: (timer) => {
      ;(timer as Timer).cancelled = true
    },
    delayMs: 300,
    retryMs: 5000,
  })
  const pendingTimer = () => timers.filter((timer) => !timer.cancelled).at(-1)
  const fire = () => {
    const timer = pendingTimer()
    if (!timer) return
    timer.cancelled = true
    timer.run()
  }
  const answer = async (index: number, result: SaveResult) => {
    puts[index].resolve(result)
    await new Promise((done) => setTimeout(done, 0))
  }
  return { sync, timers, puts, events, fire, answer, pendingTimer }
}

test('Should save a change after the pause with the revision that was loaded', async () => {
  const { sync, puts, events, fire, answer, pendingTimer } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  expect(pendingTimer()?.ms).toBe(300)
  expect(puts).toHaveLength(0)
  fire()
  expect(puts[0].state.symbol).toBe('KO')
  expect(puts[0].state.rev).toBe(4)
  expect(puts[0].keepalive).toBe(false)
  expect(sync.hasUnsaved()).toBe(true)
  await answer(0, { kind: 'saved', rev: 5 })
  expect(events).toEqual(['saved'])
  expect(sync.hasUnsaved()).toBe(false)
  expect(sync.rev()).toBe(5)
})

test('Should send only the latest of several quick changes', () => {
  const { sync, puts, fire } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  sync.changed(state('MSFT'))
  fire()
  fire()
  expect(puts.map((put) => put.state.symbol)).toEqual(['MSFT'])
})

test('Should wait for the save in flight and then send what changed meanwhile with the new revision', async () => {
  const { sync, puts, events, fire, answer } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  fire()
  sync.changed(state('MSFT'))
  fire()
  expect(puts).toHaveLength(1)
  await answer(0, { kind: 'saved', rev: 5 })
  expect(events).toEqual([])
  fire()
  expect(puts[1].state.symbol).toBe('MSFT')
  expect(puts[1].state.rev).toBe(5)
  await answer(1, { kind: 'saved', rev: 6 })
  expect(events).toEqual(['saved'])
  expect(sync.rev()).toBe(6)
})

test('Should report a conflict and drop the change that lost', async () => {
  const { sync, puts, events, fire, answer } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  fire()
  await answer(0, { kind: 'conflict' })
  expect(events).toEqual(['conflict'])
  expect(sync.hasUnsaved()).toBe(false)
  fire()
  expect(puts).toHaveLength(1)
})

test('Should report a failure and retry the same change later', async () => {
  const { sync, puts, events, fire, answer, pendingTimer } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  fire()
  await answer(0, { kind: 'failed' })
  expect(events).toEqual(['failed'])
  expect(sync.hasUnsaved()).toBe(true)
  expect(pendingTimer()?.ms).toBe(5000)
  fire()
  expect(puts[1].state.symbol).toBe('KO')
  await answer(1, { kind: 'saved', rev: 5 })
  expect(events).toEqual(['failed', 'saved'])
})

test('Should send an unsaved change at once when asked to flush', () => {
  const { sync, puts, fire } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  sync.flush()
  expect(puts).toHaveLength(1)
  expect(puts[0].keepalive).toBe(true)
  fire()
  expect(puts).toHaveLength(1)
})

test('Should send nothing when nothing changed', () => {
  const { sync, puts, fire } = makeSync()
  sync.loaded(state('AAPL'))
  sync.flush()
  fire()
  expect(puts).toHaveLength(0)
  expect(sync.hasUnsaved()).toBe(false)
})

test('Should forget a pending change when a fresh state is loaded', () => {
  const { sync, puts, fire } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  sync.loaded(state('MSFT', 9))
  fire()
  expect(puts).toHaveLength(0)
  expect(sync.hasUnsaved()).toBe(false)
  expect(sync.rev()).toBe(9)
})

test('Should ignore the answer to a save that a reload overtook', async () => {
  const { sync, events, fire, answer } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  fire()
  sync.loaded(state('MSFT', 9))
  await answer(0, { kind: 'saved', rev: 5 })
  expect(events).toEqual([])
  expect(sync.rev()).toBe(9)
})

test('Should stop its timer when disposed', () => {
  const { sync, puts, fire } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  sync.dispose()
  fire()
  expect(puts).toHaveLength(0)
})

test('Should tell the sender what the server already has', async () => {
  const { sync, puts, fire, answer } = makeSync()
  const loaded = state('AAPL')
  const first = state('KO')
  const second = state('MSFT')
  sync.loaded(loaded)
  sync.changed(first)
  fire()
  expect(puts[0].saved).toBe(loaded)
  await answer(0, { kind: 'saved', rev: 5 })
  sync.changed(second)
  sync.flush()
  expect(puts[1].keepalive).toBe(true)
  expect(puts[1].saved).toBe(first)
})

test('Should keep what the server has when a save fails', async () => {
  const { sync, puts, fire, answer } = makeSync()
  const loaded = state('AAPL')
  sync.loaded(loaded)
  sync.changed(state('KO'))
  fire()
  await answer(0, { kind: 'failed' })
  fire()
  expect(puts[1].saved).toBe(loaded)
})

const leftWhileSaving = () => {
  const setup = makeSync()
  const loaded = state('AAPL')
  const first = state('KO')
  const second = state('MSFT')
  setup.sync.loaded(loaded)
  setup.sync.changed(first)
  setup.fire()
  setup.sync.changed(second)
  setup.sync.flush()
  return { ...setup, first, second }
}

test('Should give every save a name of its own', async () => {
  const { sync, puts, fire, answer } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  fire()
  await answer(0, { kind: 'saved', rev: 5 })
  sync.changed(state('MSFT'))
  fire()
  expect(puts[0].link.saveId).toMatch(/\S/)
  expect(puts[1].link.saveId).not.toBe(puts[0].link.saveId)
  expect(puts.map((put) => put.link.follows)).toEqual([undefined, undefined])
  const other = makeSync()
  other.sync.loaded(state('AAPL'))
  other.sync.changed(state('KO'))
  other.fire()
  expect(other.puts[0].link.saveId).not.toBe(puts[0].link.saveId)
})

test('Should send a newer change after the save under way when the page is left', () => {
  const { puts, first, second } = leftWhileSaving()
  expect(puts).toHaveLength(2)
  expect(puts[1].state.symbol).toBe(second.symbol)
  expect(puts[1].state.rev).toBe(4)
  expect(puts[1].keepalive).toBe(true)
  expect(puts[1].saved).toBe(first)
  expect(puts[1].link.follows).toBe(puts[0].link.saveId)
})

test('Should send nothing more when the page is left with only the save under way', () => {
  const { sync, puts, fire } = makeSync()
  sync.loaded(state('AAPL'))
  sync.changed(state('KO'))
  fire()
  sync.flush()
  sync.flush()
  expect(puts).toHaveLength(1)
  expect(sync.hasUnsaved()).toBe(true)
})

test('Should send the newer change only once however often the page says it is being left', () => {
  const { sync, puts, fire } = leftWhileSaving()
  sync.flush()
  fire()
  expect(puts).toHaveLength(2)
})

test('Should go by the answer to the save that followed, should the page stay', async () => {
  const { sync, puts, events, fire, answer } = leftWhileSaving()
  await answer(0, { kind: 'saved', rev: 5 })
  expect(events).toEqual([])
  expect(sync.hasUnsaved()).toBe(true)
  await answer(1, { kind: 'saved', rev: 6 })
  expect(events).toEqual(['saved'])
  expect(sync.rev()).toBe(6)
  expect(sync.hasUnsaved()).toBe(false)
  sync.changed(state('NVDA'))
  fire()
  expect(puts[2].link.follows).toBeUndefined()
})

test('Should reload when the save that followed was refused', async () => {
  const { events, answer } = leftWhileSaving()
  await answer(0, { kind: 'conflict' })
  await answer(1, { kind: 'conflict' })
  expect(events).toEqual(['conflict'])
})

test('Should try the save that followed again on top of the one that did get written', async () => {
  const { puts, events, fire, answer, first, second } = leftWhileSaving()
  await answer(0, { kind: 'saved', rev: 5 })
  await answer(1, { kind: 'failed' })
  expect(events).toEqual(['failed'])
  fire()
  expect(puts[2].state).toMatchObject({ symbol: second.symbol, rev: 5 })
  expect(puts[2].saved).toBe(first)
  await answer(2, { kind: 'saved', rev: 6 })
  expect(events).toEqual(['failed', 'saved'])
})

test('Should learn of the save it overtook even when that answer comes after the follower failed', async () => {
  const { sync, puts, events, fire, answer } = leftWhileSaving()
  await answer(1, { kind: 'failed' })
  await answer(0, { kind: 'saved', rev: 5 })
  expect(events).toEqual(['failed'])
  expect(sync.hasUnsaved()).toBe(true)
  fire()
  expect(puts[2].state.rev).toBe(5)
})

test('Should not go back to an earlier revision when the save it overtook answers last', async () => {
  const { sync, answer, events } = leftWhileSaving()
  await answer(1, { kind: 'saved', rev: 6 })
  await answer(0, { kind: 'saved', rev: 5 })
  expect(sync.rev()).toBe(6)
  expect(events).toEqual(['saved'])
})
