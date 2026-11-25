import { expect, test } from 'vitest'
import { type AppState, DEFAULT_STATE } from '../../shared/types'
import { configFileName, parseConfig, serializeConfig } from './configFile'

const state: AppState = {
  ...DEFAULT_STATE,
  rev: 9,
  theme: 'light',
  symbol: 'KO',
  timeframe: 'W',
  watchlists: [
    { id: 'a', name: 'Largo plazo', items: [{ symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' }] },
    { id: 'b', name: 'Vacía', items: [] },
  ],
  activeWatchlistId: 'b',
  indicators: {
    ...DEFAULT_STATE.indicators,
    volume: { visible: false },
    rsi: { visible: true, length: 21, showMa: false },
    sma: [{ id: 's1', length: 50, color: '#FF9800', width: 2 }],
  },
  chart: { type: 'line', scale: 'log', invert: true, cursor: 'magnet', currency: 'original' },
  lines: {
    KO: [
      {
        id: 'l1',
        pane: 'price',
        timeframe: 'W',
        p1: { date: '2026-11-02', value: 60 },
        p2: { date: '2026-11-20', value: 64 },
        color: '#F23645',
        width: 3,
        extendRight: true,
        pricedAt: '2026-11-21',
      },
    ],
  },
}

test('Should name the file after the day it is exported', () => {
  expect(configFileName('2026-11-24')).toBe('doji-config-2026-11-24.json')
})

test('Should write everything but the revision', () => {
  const { rev: _rev, ...content } = state
  expect(JSON.parse(serializeConfig(state))).toEqual(content)
})

test('Should read back what it wrote', () => {
  const { rev: _rev, ...content } = state
  expect(parseConfig(serializeConfig(state))).toMatchObject(content)
})

test('Should read a copy of the file the server keeps', () => {
  const { rev: _rev, ...content } = state
  expect(parseConfig(JSON.stringify({ ...state, savedOn: '2026-11-23' }))).toMatchObject(content)
})

test('Should refuse text that is not JSON', () => {
  expect(parseConfig('')).toBeNull()
  expect(parseConfig('{not json')).toBeNull()
})

test('Should refuse JSON that is not a configuration', () => {
  expect(parseConfig('null')).toBeNull()
  expect(parseConfig('[]')).toBeNull()
  expect(parseConfig('"hola"')).toBeNull()
  expect(parseConfig('{}')).toBeNull()
  expect(parseConfig('{"watchlists":[]}')).toBeNull()
  expect(parseConfig('{"lines":{}}')).toBeNull()
  expect(parseConfig('{"watchlists":{},"lines":{}}')).toBeNull()
  expect(parseConfig('{"watchlists":[],"lines":[]}')).toBeNull()
})

test('Should repair what is unusable in a configuration instead of refusing it', () => {
  const repaired = parseConfig(
    JSON.stringify({
      theme: 'azul',
      watchlists: [{ id: 'a', name: 'Mía', items: [{ symbol: 'KO' }, { nombre: 'sin ticker' }] }],
      lines: { KO: [{ id: 'rota' }] },
    }),
  )
  expect(repaired).toMatchObject({
    theme: DEFAULT_STATE.theme,
    watchlists: [{ id: 'a', name: 'Mía', items: [{ symbol: 'KO', name: 'KO', exchange: '' }] }],
    activeWatchlistId: 'a',
    lines: {},
  })
})
