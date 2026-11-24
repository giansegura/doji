import type { Timeframe } from '../../shared/types'
import type { TimeIndex } from './timeIndex'
import type { VisibleRange } from './visibleRange'

export type PriceRange = { from: number; to: number }

export type SavedView = {
  timeframe: Timeframe
  from: string
  fromOffset: number
  to: string
  toOffset: number
  price: PriceRange | null
}

export type StorageLike = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }

export type ViewStore = { get: (key: string) => SavedView | null; set: (key: string, view: SavedView) => void }

const STORAGE_KEY = 'doji.views'
const DEFAULT_LIMIT = 200
const TIMEFRAMES: Timeframe[] = ['D', 'W', 'M']
const DATE = /^\d{4}-\d{2}-\d{2}$/

const edgeOf = (position: number, timeIndex: TimeIndex): { date: string; offset: number } => {
  const index = Math.round(position)
  return { date: timeIndex.indexToDate(index), offset: position - index }
}

export const captureView = (range: VisibleRange, timeIndex: TimeIndex, timeframe: Timeframe, price: PriceRange | null): SavedView => {
  const from = edgeOf(range.from, timeIndex)
  const to = edgeOf(range.to, timeIndex)
  return { timeframe, from: from.date, fromOffset: from.offset, to: to.date, toOffset: to.offset, price }
}

export const restoreView = (view: SavedView, timeIndex: TimeIndex): VisibleRange => ({
  from: timeIndex.dateToIndex(view.from) + view.fromOffset,
  to: timeIndex.dateToIndex(view.to) + view.toOffset,
})

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isPrice = (value: unknown): value is PriceRange => {
  const price = value as Partial<PriceRange> | null
  return typeof price === 'object' && price !== null && isNumber(price.from) && isNumber(price.to)
}

const isView = (value: unknown): value is SavedView => {
  const view = value as Partial<SavedView> | null
  return (
    typeof view === 'object' &&
    view !== null &&
    TIMEFRAMES.includes(view.timeframe as Timeframe) &&
    typeof view.from === 'string' &&
    DATE.test(view.from) &&
    typeof view.to === 'string' &&
    DATE.test(view.to) &&
    isNumber(view.fromOffset) &&
    isNumber(view.toOffset) &&
    (view.price === null || isPrice(view.price))
  )
}

const isEntry = (value: unknown): value is [string, SavedView] =>
  Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && isView(value[1])

const readAll = (storage: StorageLike | null): Map<string, SavedView> => {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]')
    return new Map(Array.isArray(parsed) ? parsed.filter(isEntry) : [])
  } catch {
    return new Map()
  }
}

export const createViewStore = (storage: StorageLike | null, limit = DEFAULT_LIMIT): ViewStore => {
  const views = readAll(storage)

  const set = (key: string, view: SavedView): void => {
    views.delete(key)
    views.set(key, view)
    ;[...views.keys()].slice(0, Math.max(views.size - limit, 0)).forEach((old) => views.delete(old))
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify([...views]))
    } catch {
      return
    }
  }

  return { get: (key) => views.get(key) ?? null, set }
}

const browserStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const sharedViewStore = createViewStore(browserStorage())
