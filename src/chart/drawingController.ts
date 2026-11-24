import type { Drawing, DrawingBase, LinePoint, PaneId, Timeframe } from '../../shared/types'
import type { Tool } from '../state/appReducer'
import { type ShapeGeometry, hitTestOutline, moveDrawing, offsetAt, outlineOf } from './drawingShapes'
import type { XY } from './lineGeometry'

export type PaneGeometry = ShapeGeometry

export type Draft = { pane: PaneId; p1: LinePoint; p2: LinePoint; kind?: 'rect' | 'channel'; offset?: number }

export type CursorKind = 'default' | 'pointer' | 'crosshair' | 'grabbing'

export type ControllerDeps = {
  getLines: () => Drawing[]
  getTimeframe: () => Timeframe
  isRsiVisible: () => boolean
  geometry: (pane: PaneId) => PaneGeometry | null
  onLinesChange: (lines: Drawing[]) => void
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

type ShapeTool = 'trendline' | 'rect' | 'channel'

type Placing = { kind: 'placing'; tool: ShapeTool; pane: PaneId; p1: LinePoint; p2: LinePoint | null; start: XY }

type Dragging = { kind: 'dragging'; part: string; original: Drawing; start: XY }

type Mode = { kind: 'idle' } | Placing | Dragging

const RELEASE_DISTANCE = 5
const IDLE: Mode = { kind: 'idle' }

const samePoint = (a: LinePoint, b: LinePoint): boolean => a.date === b.date && a.value === b.value

const draftOf = (placing: Placing, p2: LinePoint, offset: number): Draft => {
  const { pane, p1, tool } = placing
  if (tool === 'rect') return { pane, kind: 'rect', p1, p2 }
  if (tool === 'channel') return { pane, kind: 'channel', p1, p2, offset }
  return { pane, p1, p2 }
}

export const isLineVisible = (line: Drawing, timeframe: Timeframe, rsiVisible: boolean): boolean =>
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

  const hitAt = (pane: PaneId, xy: XY): { line: Drawing; part: string } | null => {
    const geometry = deps.geometry(pane)
    if (!geometry) return null
    const candidates = deps
      .getLines()
      .filter((line) => line.pane === pane && isLineVisible(line, deps.getTimeframe(), deps.isRsiVisible()))
      .reverse()
    for (const line of candidates) {
      const outline = outlineOf(line, geometry)
      const part = outline ? hitTestOutline(xy, outline) : null
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

  const replace = (updated: Drawing): void =>
    deps.onLinesChange(deps.getLines().map((line) => (line.id === updated.id ? updated : line)))

  const cancelDraft = (): void => {
    mode = IDLE
    tool = 'cursor'
    deps.onDraft(null)
  }

  const baseOf = (pane: PaneId): DrawingBase => ({
    id: deps.newId(),
    pane,
    timeframe: deps.getTimeframe(),
    color: deps.defaults.color,
    width: deps.defaults.width,
    pricedAt: deps.priceBasis(),
  })

  const add = (drawing: Drawing): void => {
    cancelDraft()
    deps.onLinesChange([...deps.getLines(), drawing])
    select(drawing.id)
    deps.onToolDone()
  }

  const shapeOf = (placing: Placing, p2: LinePoint, offset: number): Drawing => {
    const { pane, p1 } = placing
    if (placing.tool === 'rect') return { ...baseOf(pane), kind: 'rect', p1, p2 }
    if (placing.tool === 'channel') return { ...baseOf(pane), kind: 'channel', p1, p2, offset }
    return { ...baseOf(pane), p1, p2, extendRight: false }
  }

  const widthAt = (placing: Placing, p2: LinePoint, xy: XY): number | null => {
    const geometry = deps.geometry(placing.pane)
    return geometry ? offsetAt(geometry, placing.p1, p2, xy) : null
  }

  const advance = (placing: Placing, xy: XY): void => {
    if (placing.p2) {
      const offset = widthAt(placing, placing.p2, xy)
      if (offset !== null) add(shapeOf(placing, placing.p2, offset))
      return
    }
    const p2 = pointAt(placing.pane, xy)
    if (!p2 || samePoint(placing.p1, p2)) return
    if (placing.tool !== 'channel') {
      add(shapeOf(placing, p2, 0))
      return
    }
    mode = { ...placing, p2, start: xy }
    deps.onDraft(draftOf(placing, p2, 0))
  }

  const preview = (placing: Placing, xy: XY): void => {
    if (placing.p2) {
      const offset = widthAt(placing, placing.p2, xy)
      if (offset !== null) deps.onDraft(draftOf(placing, placing.p2, offset))
      return
    }
    const p2 = pointAt(placing.pane, xy)
    if (p2) deps.onDraft(draftOf(placing, p2, 0))
  }

  const startPlacing = (shape: ShapeTool, pane: PaneId, xy: XY): boolean => {
    const p1 = pointAt(pane, xy)
    if (!p1) return false
    const placing: Placing = { kind: 'placing', tool: shape, pane, p1, p2: null, start: xy }
    mode = placing
    select(null)
    deps.onDraft(draftOf(placing, p1, 0))
    return true
  }

  const placeLevel = (pane: PaneId, xy: XY): boolean => {
    const at = pointAt(pane, xy)
    if (!at) return false
    add({ ...baseOf(pane), kind: 'hline', value: at.value })
    return true
  }

  const dragTo = (dragging: Dragging, xy: XY): void => {
    const geometry = deps.geometry(dragging.original.pane)
    const moved = geometry ? moveDrawing(geometry, dragging.original, dragging.part, dragging.start, xy) : null
    if (moved) replace({ ...moved, pricedAt: deps.priceBasis() })
  }

  const setTool = (next: Tool): void => {
    if (mode.kind === 'placing') cancelDraft()
    tool = next
  }

  const pointerDown = (pane: PaneId, xy: XY): boolean => {
    if (mode.kind === 'placing') {
      if (mode.pane === pane) advance(mode, xy)
      return true
    }
    if (tool === 'hline') return placeLevel(pane, xy)
    if (tool !== 'cursor') return startPlacing(tool, pane, xy)
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
      if (mode.pane === pane) preview(mode, xy)
      return 'crosshair'
    }
    if (tool !== 'cursor') return 'crosshair'
    return hitAt(pane, xy) ? 'pointer' : 'default'
  }

  const pointerUp = (pane: PaneId, xy: XY): void => {
    if (mode.kind === 'dragging') {
      mode = IDLE
      return
    }
    if (mode.kind !== 'placing' || mode.pane !== pane) return
    const moved = Math.hypot(xy.x - mode.start.x, xy.y - mode.start.y)
    if (moved > RELEASE_DISTANCE) advance(mode, xy)
  }

  const cancel = (): void => {
    if (mode.kind !== 'dragging') return
    const { original } = mode
    mode = IDLE
    if (!deps.getLines().includes(original)) replace(original)
  }

  const key = (pressed: 'Escape' | 'Delete'): void => {
    if (pressed === 'Escape' && (mode.kind === 'placing' || tool !== 'cursor')) {
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
