import type { Drawing } from '../../shared/types'

export type LinesHistory = {
  record: (symbol: string, before: Drawing[]) => void
  undo: (symbol: string, current: Drawing[]) => Drawing[] | null
  redo: (symbol: string, current: Drawing[]) => Drawing[] | null
  clear: () => void
}

type Stacks = { undone: Drawing[][]; redone: Drawing[][] }

type HistoryDeps = { now: () => number; mergeMs?: number; limit?: number }

const MERGE_MS = 400
const LIMIT = 100

export const createLinesHistory = ({ now, mergeMs = MERGE_MS, limit = LIMIT }: HistoryDeps): LinesHistory => {
  const stacks = new Map<string, Stacks>()
  let last: { symbol: string; at: number } | null = null

  const stacksOf = (symbol: string): Stacks => {
    const existing = stacks.get(symbol)
    if (existing) return existing
    const created: Stacks = { undone: [], redone: [] }
    stacks.set(symbol, created)
    return created
  }

  const record = (symbol: string, before: Drawing[]): void => {
    const at = now()
    const sameGesture = last !== null && last.symbol === symbol && at - last.at < mergeMs
    last = { symbol, at }
    if (sameGesture) return
    const { undone, redone } = stacksOf(symbol)
    undone.push(before)
    if (undone.length > limit) undone.shift()
    redone.length = 0
  }

  const swap = (from: Drawing[][], to: Drawing[][], current: Drawing[]): Drawing[] | null => {
    const restored = from.pop()
    if (!restored) return null
    to.push(current)
    last = null
    return restored
  }

  return {
    record,
    undo: (symbol, current) => swap(stacksOf(symbol).undone, stacksOf(symbol).redone, current),
    redo: (symbol, current) => swap(stacksOf(symbol).redone, stacksOf(symbol).undone, current),
    clear: () => {
      stacks.clear()
      last = null
    },
  }
}
