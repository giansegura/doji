import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { type AppState, DEFAULT_STATE, type TrendLine } from '../shared/types'
import { createStateStore } from './stateStore'

const validLine: TrendLine = {
  id: 'a',
  pane: 'price',
  timeframe: 'D',
  p1: { date: '2026-11-02', value: 200 },
  p2: { date: '2026-11-20', value: 230 },
  color: '#F23645',
  width: 3,
  extendRight: true,
  pricedAt: '2026-11-21',
}

const makeStore = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-state-'))
  const file = join(dir, 'nested', 'state.json')
  let clock = new Date(2026, 10, 23, 12, 0, 0).getTime()
  const store = createStateStore(file, () => new Date(clock))
  const advanceDays = (days: number) => {
    clock += days * 24 * 60 * 60 * 1000
  }
  return { store, dir: join(dir, 'nested'), file, advanceDays }
}

test('Should return the defaults when the file does not exist', async () => {
  const { store } = await makeStore()
  expect(await store.read()).toEqual(DEFAULT_STATE)
})

test('Should round-trip a state through disk', async () => {
  const { store, dir } = await makeStore()
  const state: AppState = { ...DEFAULT_STATE, theme: 'light', symbol: 'KO', lines: { KO: [validLine] } }
  expect(await store.save(state, 1)).toEqual({ ok: true, rev: 2 })
  expect(await store.read()).toEqual({ ...state, rev: 2 })
  expect(await readdir(dir)).toEqual(['state.json'])
})

test('Should keep a copy of a corrupt file and fall back to defaults', async () => {
  const { store, dir, file } = await makeStore()
  await store.save(DEFAULT_STATE, 1)
  await writeFile(file, '{not json')
  expect(await store.read()).toEqual(DEFAULT_STATE)
  const copies = (await readdir(dir)).filter((name) => name.startsWith('state.json.corrupt-'))
  expect(copies).toHaveLength(1)
  expect(await readFile(join(dir, copies[0]), 'utf8')).toBe('{not json')
})

test('Should refuse a save based on an older revision and keep what is on disk', async () => {
  const { store } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  expect(await store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, 1)).toEqual({ ok: false, reason: 'conflict' })
  expect((await store.read()).symbol).toBe('KO')
})

test('Should accept only the first of several saves made from the same revision', async () => {
  const { store, dir } = await makeStore()
  const states = ['AAPL', 'MSFT', 'KO', 'NVDA'].map((symbol) => ({ ...DEFAULT_STATE, symbol }))
  const outcomes = await Promise.all(states.map((state) => store.save(state, 1)))
  expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, false, false])
  expect((await store.read()).symbol).toBe('AAPL')
  expect(await readdir(dir)).toEqual(['state.json'])
})

test('Should accept a chain of saves each based on the previous one', async () => {
  const { store } = await makeStore()
  const first = await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  const second = await store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, first.ok ? first.rev : -1)
  expect(second).toEqual({ ok: true, rev: 3 })
  expect((await store.read()).symbol).toBe('MSFT')
})

test('Should normalise what it saves', async () => {
  const { store } = await makeStore()
  await store.save({ theme: 'light', basura: true } as unknown as AppState, 1)
  expect(await store.read()).toEqual({ ...DEFAULT_STATE, theme: 'light', rev: 2 })
})

test('Should fail loudly instead of returning defaults when the file cannot be read', async () => {
  const { store, file } = await makeStore()
  await mkdir(file, { recursive: true })
  await expect(store.read()).rejects.toThrow()
  await expect(store.save(DEFAULT_STATE, 1)).rejects.toThrow()
  await rm(file, { recursive: true })
})

test('Should keep one backup per day of the file as it was before the first save of that day', async () => {
  const { store, dir, advanceDays } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  await store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, 2)
  expect(await readdir(dir)).toEqual(['state.json'])
  advanceDays(1)
  await store.save({ ...DEFAULT_STATE, symbol: 'NVDA' }, 3)
  await store.save({ ...DEFAULT_STATE, symbol: 'AAPL' }, 4)
  expect((await readdir(dir)).sort()).toEqual(['state.json', 'state.json.bak-2026-11-24'])
  const backup = JSON.parse(await readFile(join(dir, 'state.json.bak-2026-11-24'), 'utf8')) as AppState
  expect(backup.symbol).toBe('MSFT')
})

test('Should keep only the seven most recent backups', async () => {
  const { store, dir, advanceDays } = await makeStore()
  await store.save(DEFAULT_STATE, 1)
  for (let day = 0; day < 10; day += 1) {
    advanceDays(1)
    await store.save(DEFAULT_STATE, day + 2)
  }
  const backups = (await readdir(dir)).filter((name) => name.includes('.bak-')).sort()
  expect(backups).toHaveLength(7)
  expect(backups[0]).toBe('state.json.bak-2026-11-27')
  expect(backups[6]).toBe('state.json.bak-2026-12-03')
})
