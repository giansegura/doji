import type { LinePoint, PaneId, Timeframe, TrendLine } from '../../shared/types'
import type { Tool } from '../state/appReducer'
import { type LineHit, type XY, hitTestLine } from './lineGeometry'

export type PaneGeometry = {
  toPoint: (xy: XY) => LinePoint | null
  toXY: (point: LinePoint) => XY | null
  width: number
}

export type Draft = { pane: PaneId; p1: LinePoint; p2: LinePoint }

export type CursorKind = 'default' | 'pointer' | 'crosshair' | 'grabbing'

export type ControllerDeps = {
  getLines: () => TrendLine[]
  getTimeframe: () => Timeframe
  isRsiVisible: () => boolean
  geometry: (pane: PaneId) => PaneGeometry | null
  onLinesChange: (lines: TrendLine[]) => void
  onSelect: (id: string | null) => void
  onDraft: (draft: Draft | null) => void
  onToolDone: () => void
  newId: () => string
  priceBasis: () => string
  defaults: { color: string; width: number }
}

export type DrawingController = {
  setTool: (tool: Tool) => void
  pointerDown: (pane: PaneId, xy: XY) => boolean
  pointerMove: (pane: PaneId, xy: XY) => CursorKind
  pointerUp: (pane: PaneId, xy: XY) => void
  key: (key: 'Escape' | 'Delete') => void
  cancel: () => void
  select: (id: string | null) => void
  syncVisibility: () => void
  getSelectedId: () => string | null
}

type Placing = { kind: 'placing'; pane: PaneId; p1: LinePoint; start: XY }

type Dragging = { kind: 'dragging'; part: Exclude<LineHit, null>; original: TrendLine; start: XY }

type Mode = { kind: 'idle' } | Placing | Dragging

const RELEASE_DISTANCE = 5
const IDLE: Mode = { kind: 'idle' }

const samePoint = (a: LinePoint, b: LinePoint): boolean => a.date === b.date && a.value === b.value

const shift = (xy: XY, dx: number, dy: number): XY => ({ x: xy.x + dx, y: xy.y + dy })

const movePoint = (geometry: PaneGeometry, from: LinePoint, to: XY): LinePoint | null => {
  const moved = geometry.toPoint(to)
  const at = geometry.toXY(from)
  const rested = at ? geometry.toPoint(at) : null
  if (!moved) return null
  return rested?.date === moved.date ? { ...moved, date: from.date } : moved
}

export const isLineVisible = (line: TrendLine, timeframe: Timeframe, rsiVisible: boolean): boolean =>
  line.pane === 'price' || (rsiVisible && line.timeframe === timeframe)

export const createDrawingController = (deps: ControllerDeps): DrawingController => {
  let tool: Tool = 'cursor'
  let mode: Mode = IDLE
  let selectedId: string | null = null

  const select = (id: string | null): void => {
    if (id === selectedId) return
    selectedId = id
    deps.onSelect(id)
  }

  const pointAt = (pane: PaneId, xy: XY): LinePoint | null => deps.geometry(pane)?.toPoint(xy) ?? null

  const hitAt = (pane: PaneId, xy: XY): { line: TrendLine; part: Exclude<LineHit, null> } | null => {
    const geometry = deps.geometry(pane)
    if (!geometry) return null
    const candidates = deps
      .getLines()
      .filter((line) => line.pane === pane && isLineVisible(line, deps.getTimeframe(), deps.isRsiVisible()))
      .reverse()
    for (const line of candidates) {
      const a = geometry.toXY(line.p1)
      const b = geometry.toXY(line.p2)
      const part = a && b ? hitTestLine(xy, a, b, { extendRight: line.extendRight, width: geometry.width }) : null
      if (part) return { line, part }
    }
    return null
  }

  const selectedVisible = (): boolean =>
    deps
      .getLines()
      .some((line) => line.id === selectedId && isLineVisible(line, deps.getTimeframe(), deps.isRsiVisible()))

  const syncVisibility = (): void => {
    if (selectedId !== null && mode.kind !== 'dragging' && !selectedVisible()) select(null)
  }

  const replace = (updated: TrendLine): void =>
    deps.onLinesChange(deps.getLines().map((line) => (line.id === updated.id ? updated : line)))

  const cancelDraft = (): void => {
    mode = IDLE
    tool = 'cursor'
    deps.onDraft(null)
  }

  const finish = (placing: Placing, p2: LinePoint): void => {
    if (samePoint(placing.p1, p2)) return
    const line: TrendLine = {
      id: deps.newId(),
      pane: placing.pane,
      timeframe: deps.getTimeframe(),
      p1: placing.p1,
      p2,
      color: deps.defaults.color,
      width: deps.defaults.width,
      extendRight: false,
      pricedAt: deps.priceBasis(),
    }
    cancelDraft()
    deps.onLinesChange([...deps.getLines(), line])
    select(line.id)
    deps.onToolDone()
  }

  const startPlacing = (pane: PaneId, xy: XY): boolean => {
    const p1 = pointAt(pane, xy)
    if (!p1) return false
    mode = { kind: 'placing', pane, p1, start: xy }
    select(null)
    deps.onDraft({ pane, p1, p2: p1 })
    return true
  }

  const dragTo = (dragging: Dragging, xy: XY): void => {
    const geometry = deps.geometry(dragging.original.pane)
    if (!geometry) return
    const { original, part, start } = dragging
    if (part !== 'body') {
      const end = movePoint(geometry, original[part], xy)
      if (end) replace({ ...original, [part]: end, pricedAt: deps.priceBasis() })
      return
    }
    const a = geometry.toXY(original.p1)
    const b = geometry.toXY(original.p2)
    if (!a || !b) return
    const dx = xy.x - start.x
    const dy = xy.y - start.y
    const p1 = movePoint(geometry, original.p1, shift(a, dx, dy))
    const p2 = movePoint(geometry, original.p2, shift(b, dx, dy))
    if (p1 && p2) replace({ ...original, p1, p2, pricedAt: deps.priceBasis() })
  }

  const setTool = (next: Tool): void => {
    if (mode.kind === 'placing') cancelDraft()
    tool = next
  }

  const pointerDown = (pane: PaneId, xy: XY): boolean => {
    if (mode.kind === 'placing') {
      const p2 = mode.pane === pane ? pointAt(pane, xy) : null
      if (p2) finish(mode, p2)
      return true
    }
    if (tool === 'trendline') return startPlacing(pane, xy)
    const hit = hitAt(pane, xy)
    if (!hit) {
      select(null)
      return false
    }
    select(hit.line.id)
    mode = { kind: 'dragging', part: hit.part, original: hit.line, start: xy }
    return true
  }

  const pointerMove = (pane: PaneId, xy: XY): CursorKind => {
    if (mode.kind === 'dragging') {
      dragTo(mode, xy)
      return 'grabbing'
    }
    if (mode.kind === 'placing') {
      const p2 = mode.pane === pane ? pointAt(pane, xy) : null
      if (p2) deps.onDraft({ pane, p1: mode.p1, p2 })
      return 'crosshair'
    }
    if (tool === 'trendline') return 'crosshair'
    return hitAt(pane, xy) ? 'pointer' : 'default'
  }

  const pointerUp = (pane: PaneId, xy: XY): void => {
    if (mode.kind === 'dragging') {
      mode = IDLE
      return
    }
    if (mode.kind !== 'placing' || mode.pane !== pane) return
    const p2 = pointAt(pane, xy)
    const moved = Math.hypot(xy.x - mode.start.x, xy.y - mode.start.y)
    if (p2 && moved > RELEASE_DISTANCE) finish(mode, p2)
  }

  const cancel = (): void => {
    if (mode.kind !== 'dragging') return
    const { original } = mode
    mode = IDLE
    if (!deps.getLines().includes(original)) replace(original)
  }

  const key = (pressed: 'Escape' | 'Delete'): void => {
    if (pressed === 'Escape' && (mode.kind === 'placing' || tool === 'trendline')) {
      cancelDraft()
      deps.onToolDone()
      return
    }
    if (pressed === 'Escape') {
      select(null)
      return
    }
    if (mode.kind !== 'idle' || !selectedVisible()) return
    const removed = selectedId
    deps.onLinesChange(deps.getLines().filter((line) => line.id !== removed))
    select(null)
  }

  return {
    setTool,
    pointerDown,
    pointerMove,
    pointerUp,
    key,
    cancel,
    select,
    syncVisibility,
    getSelectedId: () => selectedId,
  }
}
