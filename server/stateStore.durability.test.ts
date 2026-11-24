import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { DEFAULT_STATE } from '../shared/types'
import { createStateStore } from './stateStore'

const calls = vi.hoisted(() => [] as string[])

vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>()
  const nameOf = (path: unknown): string => String(path).split('/').at(-1) ?? ''
  const open: typeof real.open = async (path, ...rest) => {
    const handle = await real.open(path, ...rest)
    const sync = handle.sync.bind(handle)
    handle.sync = async () => {
      calls.push(`sync ${nameOf(path)}`)
      await sync()
    }
    return handle
  }
  const rename: typeof real.rename = async (from, to) => {
    calls.push(`rename ${nameOf(to)}`)
    await real.rename(from, to)
  }
  return { ...real, open, rename, default: { ...real, open, rename } }
})

test('Should flush the state to disk before putting it in place', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'doji-state-'))
  const store = createStateStore(join(dir, 'state.json'))
  await store.save({ ...DEFAULT_STATE, symbol: 'KO' }, 1)
  expect(calls).toEqual(['sync state.json.tmp', 'rename state.json'])
  expect((await store.read()).symbol).toBe('KO')
  expect(await readdir(dir)).toEqual(['state.json'])
})
