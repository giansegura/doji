import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
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
  const advanceSeconds = (seconds: number) => {
    clock += seconds * 1000
  }
  const advanceDays = (days: number) => advanceSeconds(days * 24 * 60 * 60)
  // The revision a copy brought from elsewhere takes at the moment of the clock.
  const broughtAt = () => clock
  const replaced = async (state: AppState, baseRev: number): Promise<number> => {
    const outcome = await store.replace(state, baseRev)
    if (!outcome.ok) throw new Error('refused')
    return outcome.rev
  }
  return { store, dir: join(dir, 'nested'), file, advanceDays, advanceSeconds, broughtAt, replaced }
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

test('Should keep a copy of the file it replaces even when today already has one', async () => {
  const { store, dir, advanceDays, broughtAt } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  advanceDays(1)
  await store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, 2)
  expect(await store.replace({ ...DEFAULT_STATE, symbol: 'NVDA' }, 3)).toEqual({ ok: true, rev: broughtAt() })
  expect((await store.read()).symbol).toBe('NVDA')
  expect((await readdir(dir)).sort()).toEqual(['state.json', 'state.json.bak-2026-11-24', 'state.json.bak-2026-11-24-120000'])
  const daily = JSON.parse(await readFile(join(dir, 'state.json.bak-2026-11-24'), 'utf8')) as AppState
  const replaced = JSON.parse(await readFile(join(dir, 'state.json.bak-2026-11-24-120000'), 'utf8')) as AppState
  expect([daily.symbol, replaced.symbol]).toEqual(['KO', 'MSFT'])
})

test('Should keep a copy under the day when the file it replaces is the first change of the day', async () => {
  const { store, dir } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  await store.replace({ ...DEFAULT_STATE, symbol: 'NVDA' }, 2)
  expect((await readdir(dir)).sort()).toEqual(['state.json', 'state.json.bak-2026-11-23'])
  expect(JSON.parse(await readFile(join(dir, 'state.json.bak-2026-11-23'), 'utf8'))).toMatchObject({ symbol: 'KO' })
})

test('Should never overwrite an earlier copy when it replaces twice in the same second', async () => {
  const { store, dir, replaced } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  let rev = await replaced({ ...DEFAULT_STATE, symbol: 'MSFT' }, 2)
  rev = await replaced({ ...DEFAULT_STATE, symbol: 'NVDA' }, rev)
  await replaced({ ...DEFAULT_STATE, symbol: 'AAPL' }, rev)
  const copies = (await readdir(dir)).filter((name) => name.includes('.bak-')).sort()
  const symbols = await Promise.all(copies.map(async (name) => (JSON.parse(await readFile(join(dir, name), 'utf8')) as AppState).symbol))
  expect(symbols).toEqual(['KO', 'MSFT', 'NVDA'])
})

test('Should refuse to replace a state that changed since it was read', async () => {
  const { store, dir } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  expect(await store.replace({ ...DEFAULT_STATE, symbol: 'MSFT' }, 1)).toEqual({ ok: false, reason: 'conflict' })
  expect((await store.read()).symbol).toBe('KO')
  expect(await readdir(dir)).toEqual(['state.json'])
})

const copiesIn = async (dir: string) => {
  const names = (await readdir(dir)).filter((name) => name.includes('.bak-'))
  const daily = names.filter((name) => /\.bak-\d{4}-\d{2}-\d{2}$/.test(name)).sort()
  const replaced = names.filter((name) => !daily.includes(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const symbolsOf = (list: string[]) =>
    Promise.all(list.map(async (name) => (JSON.parse(await readFile(join(dir, name), 'utf8')) as AppState).symbol))
  return { daily, replaced, symbolsOf }
}

test('Should keep seven daily copies and, apart from them, the ten last ones it replaced', async () => {
  const { store, dir, advanceDays, advanceSeconds, replaced: replace } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  let rev = 2
  for (let day = 0; day < 8; day += 1) {
    advanceDays(1)
    await store.save({ ...DEFAULT_STATE, symbol: `DAY${day}` }, rev++)
  }
  for (let turn = 0; turn < 12; turn += 1) {
    advanceSeconds(1)
    rev = await replace({ ...DEFAULT_STATE, symbol: `NEW${turn}` }, rev)
  }
  const { daily, replaced, symbolsOf } = await copiesIn(dir)
  expect(daily).toEqual([25, 26, 27, 28, 29, 30].map((day) => `state.json.bak-2026-11-${day}`).concat('state.json.bak-2026-12-01'))
  expect(replaced).toHaveLength(10)
  expect(await symbolsOf(replaced)).toEqual(Array.from({ length: 10 }, (_, index) => `NEW${index + 1}`))
})

test('Should keep the newest replaced copies even when many are made in one second', async () => {
  const { store, dir, replaced: replace } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  let rev = 2
  for (let turn = 0; turn < 14; turn += 1) rev = await replace({ ...DEFAULT_STATE, symbol: `NEW${turn}` }, rev)
  const { daily, replaced, symbolsOf } = await copiesIn(dir)
  expect(await symbolsOf(daily)).toEqual(['KO'])
  expect(await symbolsOf(replaced)).toEqual(Array.from({ length: 10 }, (_, index) => `NEW${index + 3}`))
})

test('Should tell replaced copies from daily ones whatever the file is called', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-state-'))
  let clock = new Date(2026, 10, 23, 9, 0, 0).getTime()
  const store = createStateStore(join(dir, 'my (state).json'), () => new Date(clock))
  await store.save(DEFAULT_STATE, 1)
  for (let turn = 0; turn < 12; turn += 1) {
    clock += 1000
    await store.replace(DEFAULT_STATE, (await store.read()).rev)
  }
  const { daily, replaced } = await copiesIn(dir)
  expect(daily).toEqual(['my (state).json.bak-2026-11-23'])
  expect(replaced).toHaveLength(10)
  expect(replaced[0]).toBe('my (state).json.bak-2026-11-23-090003')
})

test('Should say when the file last changed, and nothing while there is no file', async () => {
  const { store, file } = await makeStore()
  expect(await store.changedAt()).toBeNull()
  await store.save(DEFAULT_STATE, 1)
  const moment = new Date('2026-11-20T10:30:00.000Z')
  await utimes(file, moment, moment)
  expect(await store.changedAt()).toBe(moment.getTime())
  expect(await store.changedAt()).toBe((await stat(file)).mtimeMs)
})

test.each([
  ['text that is not JSON', '{ oops'],
  ['an empty file', ''],
  ['a list', '[1]'],
  ['a bare value', 'null'],
  ['an empty object', '{ }'],
])('Should count a file holding %s as one that says nothing about when settings changed', async (_name, text) => {
  const { store, dir, file } = await makeStore()
  await store.save(DEFAULT_STATE, 1)
  await writeFile(file, text)
  expect(await store.changedAt()).toBeNull()
  expect(await readdir(dir)).toEqual(['state.json'])
})

test('Should keep a copy of settings from elsewhere as they came, leaving its own file alone', async () => {
  const { store, dir, file } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  const before = await readFile(file, 'utf8')
  await store.keepCopy('{"symbol":"NVDA","future":1}')
  await store.keepCopy('{"symbol":"TSLA"}')
  expect(await readFile(file, 'utf8')).toBe(before)
  expect((await readdir(dir)).sort()).toEqual(['state.json', 'state.json.bak-2026-11-23-120000', 'state.json.bak-2026-11-23-120000-2'])
  expect(await readFile(join(dir, 'state.json.bak-2026-11-23-120000'), 'utf8')).toBe('{"symbol":"NVDA","future":1}')
  expect(await readFile(join(dir, 'state.json.bak-2026-11-23-120000-2'), 'utf8')).toBe('{"symbol":"TSLA"}')
})

test('Should keep copies from elsewhere before it has settings of its own', async () => {
  const { store, dir } = await makeStore()
  await store.keepCopy('{"symbol":"NVDA"}')
  expect(await readdir(dir)).toEqual(['state.json.bak-2026-11-23-120000'])
})

test('Should count copies from elsewhere with the replaced ones, never against the daily ones', async () => {
  const { store, dir, advanceDays, advanceSeconds } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  advanceDays(1)
  await store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, 2)
  for (let turn = 0; turn < 12; turn += 1) {
    advanceSeconds(1)
    await store.keepCopy(JSON.stringify({ symbol: `NEW${turn}` }))
  }
  const { daily, replaced, symbolsOf } = await copiesIn(dir)
  expect(daily).toEqual(['state.json.bak-2026-11-24'])
  expect(await symbolsOf(replaced)).toEqual(Array.from({ length: 10 }, (_, index) => `NEW${index + 2}`))
})

test('Should keep the newest replaced copies after the clock goes back, as when summer time ends', async () => {
  const { store, dir, advanceSeconds, replaced: replace } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  let rev = 2
  for (let turn = 0; turn < 11; turn += 1) {
    advanceSeconds(1)
    rev = await replace({ ...DEFAULT_STATE, symbol: `NEW${turn}` }, rev)
  }
  advanceSeconds(-60 * 60)
  for (let turn = 11; turn < 14; turn += 1) {
    advanceSeconds(1)
    rev = await replace({ ...DEFAULT_STATE, symbol: `NEW${turn}` }, rev)
  }
  await store.keepCopy('{"symbol":"THEIRS"}')
  const { daily, replaced, symbolsOf } = await copiesIn(dir)
  expect(await symbolsOf(daily)).toEqual(['KO'])
  expect(await symbolsOf(replaced)).toEqual([...Array.from({ length: 9 }, (_, index) => `NEW${index + 4}`), 'THEIRS'])
})

test('Should give the settings and the time they changed as they stand together, after a save under way', async () => {
  const { store, file } = await makeStore()
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  const old = new Date('2026-11-20T10:30:00.000Z')
  await utimes(file, old, old)
  const saving = store.save({ ...DEFAULT_STATE, symbol: 'MSFT' }, 2)
  const seen = await store.snapshot()
  await saving
  expect(seen.state).toMatchObject({ symbol: 'MSFT', rev: 3 })
  expect(seen.changedAt).toBe((await stat(file)).mtimeMs)
})

test('Should give the defaults and no time of change while there are no settings', async () => {
  const { store } = await makeStore()
  expect(await store.snapshot()).toEqual({ state: DEFAULT_STATE, changedAt: null })
})

test.each([
  ['deleted', (file: string) => rm(file)],
  ['broken', (file: string) => writeFile(file, '{ oops')],
  ['emptied', (file: string) => writeFile(file, '{}')],
])('Should give a copy brought over %s settings a revision no page was ever shown', async (_name, lose) => {
  const { store, file, advanceSeconds, replaced } = await makeStore()
  await store.save(DEFAULT_STATE, 1)
  await store.save(DEFAULT_STATE, 2)
  const shown = [1, 2, 3]
  for (let loss = 1; loss <= 2; loss += 1) {
    await lose(file)
    advanceSeconds(1)
    const rev = await replaced({ ...DEFAULT_STATE, symbol: 'NVDA' }, 1)
    expect(rev).toBeGreaterThan(Math.max(...shown))
    for (const held of shown.slice(1)) expect(await store.save(DEFAULT_STATE, held)).toMatchObject({ ok: false })
    expect(await store.save({ ...DEFAULT_STATE, symbol: 'NVDA' }, rev)).toEqual({ ok: true, rev: rev + 1 })
    shown.push(rev, rev + 1)
  }
})

test('Should go on counting up when a copy is brought with the clock set back', async () => {
  const { store, advanceSeconds, replaced } = await makeStore()
  await store.save(DEFAULT_STATE, 1)
  const first = await replaced(DEFAULT_STATE, 2)
  advanceSeconds(-60)
  expect(await replaced(DEFAULT_STATE, first)).toBe(first + 1)
})
