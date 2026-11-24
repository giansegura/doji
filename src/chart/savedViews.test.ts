import { expect, test } from 'vitest'
import { addWeekdays } from '../../shared/dates'
import { type SavedView, type StorageLike, captureView, createViewStore, restoreView } from './savedViews'
import { createTimeIndex } from './timeIndex'

const START = '2020-01-06'
const days = (count: number, from = START): string[] => Array.from({ length: count }, (_, index) => addWeekdays(from, index))
const daily = createTimeIndex(days(1600), 'D')

const view = (over: Partial<SavedView> = {}): SavedView => ({
  timeframe: 'D',
  from: '2021-03-01',
  fromOffset: -0.5,
  to: '2022-06-15',
  toOffset: 0.25,
  price: null,
  ...over,
})

test('Should remember a view by the dates at its edges', () => {
  const from = daily.dateToIndex('2021-03-01') - 0.5
  const to = daily.dateToIndex('2022-06-15') + 0.25
  expect(captureView({ from, to }, daily, 'D', null)).toEqual(view())
})

test('Should remember the price range of a view that was moved by hand', () => {
  const from = daily.dateToIndex('2021-03-01') - 0.5
  const to = daily.dateToIndex('2022-06-15') + 0.25
  expect(captureView({ from, to }, daily, 'D', { from: 120, to: 180 }).price).toEqual({ from: 120, to: 180 })
})

test('Should bring back the same bars, even with new bars added since', () => {
  const grown = createTimeIndex(days(1630), 'D')
  const range = restoreView(view(), grown)
  expect(range.from).toBe(grown.dateToIndex('2021-03-01') - 0.5)
  expect(range.to).toBe(grown.dateToIndex('2022-06-15') + 0.25)
})

test('Should keep the space after the last bar when the view reached into the future', () => {
  const last = days(1600).at(-1) as string
  const ahead = captureView({ from: 1450.5, to: 1609.5 }, daily, 'D', null)
  expect(ahead.to > last).toBe(true)
  expect(restoreView(ahead, daily)).toEqual({ from: 1450.5, to: 1609.5 })
})

test('Should bring back the same dates on another timeframe', () => {
  const weekly = createTimeIndex(
    days(1600).filter((_, index) => index % 5 === 0),
    'W',
  )
  const range = restoreView(view(), weekly)
  expect(Math.round(range.from + 0.5)).toBe(weekly.dateToIndex('2021-03-01'))
  expect(Math.round(range.to - 0.25)).toBe(weekly.dateToIndex('2022-06-15'))
})

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) }
}

test('Should keep views by key and give them back', () => {
  const store = createViewStore(memory())
  store.set('main:AAPL', view())
  expect(store.get('main:AAPL')).toEqual(view())
  expect(store.get('main:MSFT')).toBeNull()
})

test('Should keep the views in the browser so they survive a reload', () => {
  const storage = memory()
  createViewStore(storage).set('main:AAPL', view({ price: { from: 1, to: 2 } }))
  expect(createViewStore(storage).get('main:AAPL')).toEqual(view({ price: { from: 1, to: 2 } }))
})

test('Should forget the oldest views beyond its limit', () => {
  const store = createViewStore(memory(), 3)
  ;['A', 'B', 'C'].forEach((symbol) => store.set(`main:${symbol}`, view()))
  store.set('main:A', view({ from: '2021-04-01' }))
  store.set('main:D', view())
  expect(['A', 'B', 'C', 'D'].map((symbol) => store.get(`main:${symbol}`) !== null)).toEqual([true, false, true, true])
})

test('Should ignore what it cannot read from the browser', () => {
  const storage = memory()
  storage.setItem('doji.views', 'no es json')
  expect(createViewStore(storage).get('main:AAPL')).toBeNull()
  storage.setItem('doji.views', JSON.stringify([['main:AAPL', { ...view(), from: 7 }], ['main:KO', view()], 'x']))
  const store = createViewStore(storage)
  expect(store.get('main:AAPL')).toBeNull()
  expect(store.get('main:KO')).toEqual(view())
})

test('Should still work in memory when the browser refuses to store anything', () => {
  const broken: StorageLike = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  }
  const store = createViewStore(broken)
  store.set('main:AAPL', view())
  expect(store.get('main:AAPL')).toEqual(view())
  expect(createViewStore(null).get('main:AAPL')).toBeNull()
})
