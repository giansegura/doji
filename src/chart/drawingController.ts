import type { Drawing, DrawingBase, DrawingKind, LineLook, LinePoint, PaneId, PositionSide, Timeframe } from '../../shared/types'
import { canAlert, withoutAlert } from '../../shared/drawings'
import { withLook } from '../domain/lineLooks'
import type { Tool } from '../state/appReducer'
import { type ShapeGeometry, hitTestOutline, moveDrawing, offsetAt, outlineOf } from './drawingShapes'
import { HIT_TOLERANCE, type XY } from './lineGeometry'
import type { Measure } from './measure'

export type PaneGeometry = ShapeGeometry

export type Draft = { pane: PaneId; p1: LinePoint; p2: LinePoint; kind?: 'rect' | 'channel' | 'zone'; offset?: number }

export type CursorKind = 'default' | 'pointer' | 'crosshair' | 'grabbing'

export type ControllerDeps = {
  getLines: () => Drawing[]
  getTimeframe: () => Timeframe
  isRsiVisible: () => boolean
  geometry: (pane: PaneId) => PaneGeometry | null
  onLinesChange: (lines: Drawing[]) => void
  onSelect: (id: string | null) => void
  onDraft: (draft: Draft | null) => void
  onMeasure: (measure: Measure | null) => void
  onToolDone: () => void
  newId: () => string
  priceBasis: () => string
  lookFor: (kind: DrawingKind) => LineLook
  levels?: () => number[]
  levelLook?: () => LineLook
}

export type DrawingController = {
  setTool: (tool: Tool) => void
  pointerDown: (pane: PaneId, xy: XY) => boolean
  pointerMove: (pane: PaneId, xy: XY) => CursorKind
  pointerUp: (pane: PaneId, xy: XY) => void
  click: (pane: PaneId, xy: XY) => void
  key: (key: 'Escape' | 'Delete') => void
  cancel: () => void
  select: (id: string | null) => void
  clearMeasure: () => void
  syncVisibility: () => void
  getSelectedId: () => string | null
}

type ShapeTool = 'trendline' | 'rect' | 'channel' | 'zone'

type Placing = { kind: 'placing'; tool: ShapeTool; pane: PaneId; p1: LinePoint; p2: LinePoint | null; start: XY }

type Dragging = { kind: 'dragging'; part: string; original: Drawing; start: XY }

type Measuring = { kind: 'measuring'; p1: LinePoint; start: XY }

type Mode = { kind: 'idle' } | Placing | Dragging | Measuring

const MEASURE_PANE: PaneId = 'price'
const POSITION_LENGTH = 120
const POSITION_RISK = 40
const REWARD_TO_RISK = 2

const RELEASE_DISTANCE = 5
const NEW_NOTE = 'Text'
const IDLE: Mode = { kind: 'idle' }

const samePoint = (a: LinePoint, b: LinePoint): boolean => a.date === b.date && a.value === b.value

const withAlertOf = (drawing: Drawing, stored: Drawing): Drawing => {
  if (!canAlert(drawing)) return drawing
  const quiet = withoutAlert(drawing)
  return canAlert(stored) && stored.alert === true ? ({ ...quiet, alert: true } as Drawing) : quiet
}

const draftOf = (placing: Placing, p2: LinePoint, offset: number): Draft => {
  const { pane, p1, tool } = placing
  if (tool === 'rect') return { pane, kind: 'rect', p1, p2 }
  if (tool === 'zone') return { pane, kind: 'zone', p1, p2 }
  if (tool === 'channel') return { pane, kind: 'channel', p1, p2, offset }
  return { pane, p1, p2 }
}

export const isLineVisible = (line: Drawing, timeframe: Timeframe, rsiVisible: boolean): boolean =>
  line.pane === 'price' || (rsiVisible && line.timeframe === timeframe)

export const createDrawingController = (deps: ControllerDeps): DrawingController => {
  let tool: Tool = 'cursor'
  let mode: Mode = IDLE
  let selectedId: string | null = null
  let measured = false

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

  const levelAt = (pane: PaneId, xy: XY): number | null => {
    const geometry = pane === 'price' ? deps.geometry(pane) : null
    if (!geometry) return null
    return (
      (deps.levels?.() ?? []).find((price) => {
        const y = geometry.toY(price)
        return y !== null && Math.abs(y - xy.y) <= HIT_TOLERANCE
      }) ?? null
    )
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

  const storedOf = (drawing: Drawing): Drawing => deps.getLines().find((line) => line.id === drawing.id) ?? drawing

  const cancelDraft = (): void => {
    mode = IDLE
    tool = 'cursor'
    deps.onDraft(null)
  }

  const baseOf = (pane: PaneId, look: LineLook): DrawingBase => ({
    id: deps.newId(),
    pane,
    timeframe: deps.getTimeframe(),
    color: look.color,
    width: look.width,
    pricedAt: deps.priceBasis(),
  })

  const styled = <Shape extends Drawing>(kind: DrawingKind, pane: PaneId, shape: (base: DrawingBase) => Shape): Drawing => {
    const look = deps.lookFor(kind)
    return withLook(shape(baseOf(pane, look)), look)
  }

  const add = (drawing: Drawing): void => {
    cancelDraft()
    deps.onLinesChange([...deps.getLines(), drawing])
    select(drawing.id)
    deps.onToolDone()
  }

  const shapeOf = (placing: Placing, p2: LinePoint, offset: number): Drawing => {
    const { pane, p1 } = placing
    if (placing.tool === 'rect') return styled('rect', pane, (base) => ({ ...base, kind: 'rect', p1, p2 }))
    if (placing.tool === 'zone') {
      return styled('zone', pane, (base) => ({ ...base, kind: 'zone', top: Math.max(p1.value, p2.value), bottom: Math.min(p1.value, p2.value) }))
    }
    if (placing.tool === 'channel') return styled('channel', pane, (base) => ({ ...base, kind: 'channel', p1, p2, offset }))
    return styled('trend', pane, (base) => ({ ...base, p1, p2, extendRight: false }))
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
    if (placing.tool === 'channel' && placing.p1.date === p2.date) return
    if (placing.tool === 'zone' && placing.p1.value === p2.value) return
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

  const placePosition = (side: PositionSide, pane: PaneId, xy: XY): boolean => {
    const entry = pane === 'price' ? pointAt(pane, xy) : null
    const end = entry ? pointAt(pane, { x: xy.x + POSITION_LENGTH, y: xy.y }) : null
    const away = entry ? pointAt(pane, { x: xy.x, y: xy.y + POSITION_RISK }) : null
    const risk = entry && away ? Math.abs(away.value - entry.value) : 0
    if (!entry || !end || risk <= 0) return false
    const sign = side === 'long' ? 1 : -1
    const limit = side === 'long' ? entry.value : entry.value / REWARD_TO_RISK
    const distance = risk < limit ? risk : limit / 2
    add(
      styled('position', pane, (base) => ({
        ...base,
        kind: 'position',
        side,
        p1: entry,
        p2: { date: end.date, value: entry.value },
        stop: entry.value - sign * distance,
        target: entry.value + sign * distance * REWARD_TO_RISK,
      })),
    )
    return true
  }

  const placeLevel = (pane: PaneId, xy: XY, ray: boolean): boolean => {
    const at = pointAt(pane, xy)
    if (!at) return false
    add(styled('hline', pane, (base) => ({ ...base, kind: 'hline', value: at.value, ...(ray ? { from: at.date } : {}) })))
    return true
  }

  const placeVertical = (pane: PaneId, xy: XY): boolean => {
    const at = pointAt(pane, xy)
    if (!at) return false
    add(styled('vline', pane, (base) => ({ ...base, kind: 'vline', date: at.date })))
    return true
  }

  const placeNote = (pane: PaneId, xy: XY): boolean => {
    const at = pointAt(pane, xy)
    if (!at) return false
    add(styled('note', pane, (base) => ({ ...base, kind: 'note', p1: at, text: NEW_NOTE })))
    return true
  }

  const dragTo = (dragging: Dragging, xy: XY): void => {
    const geometry = deps.geometry(dragging.original.pane)
    const moved = geometry ? moveDrawing(geometry, dragging.original, dragging.part, dragging.start, xy) : null
    if (moved) replace(withAlertOf({ ...moved, pricedAt: deps.priceBasis() }, storedOf(dragging.original)))
  }

  const clearMeasure = (): void => {
    if (mode.kind === 'measuring') mode = IDLE
    if (!measured) return
    measured = false
    deps.onMeasure(null)
  }

  const showMeasure = (p1: LinePoint, xy: XY): void => {
    const p2 = pointAt(MEASURE_PANE, xy)
    if (!p2) return
    measured = true
    deps.onMeasure({ pane: MEASURE_PANE, p1, p2 })
  }

  const startMeasuring = (pane: PaneId, xy: XY): boolean => {
    const p1 = pointAt(pane, xy)
    if (pane !== MEASURE_PANE || !p1) return false
    select(null)
    mode = { kind: 'measuring', p1, start: xy }
    showMeasure(p1, xy)
    return true
  }

  const finishMeasuring = (measuring: Measuring, xy: XY): void => {
    showMeasure(measuring.p1, xy)
    mode = IDLE
    tool = 'cursor'
    deps.onToolDone()
  }

  const setTool = (next: Tool): void => {
    if (mode.kind === 'placing') cancelDraft()
    if (mode.kind === 'measuring') clearMeasure()
    tool = next
  }

  const pointerDown = (pane: PaneId, xy: XY): boolean => {
    if (mode.kind === 'measuring') {
      if (pane === MEASURE_PANE) finishMeasuring(mode, xy)
      return true
    }
    if (mode.kind === 'placing') {
      if (mode.pane === pane) advance(mode, xy)
      return true
    }
    clearMeasure()
    if (tool === 'measure') return startMeasuring(pane, xy)
    if (tool === 'hline' || tool === 'ray') return placeLevel(pane, xy, tool === 'ray')
    if (tool === 'vline') return placeVertical(pane, xy)
    if (tool === 'note') return placeNote(pane, xy)
    if (tool === 'long' || tool === 'short') return placePosition(tool, pane, xy)
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
    if (mode.kind === 'measuring') {
      if (pane === MEASURE_PANE) showMeasure(mode.p1, xy)
      return 'crosshair'
    }
    if (mode.kind === 'dragging') {
      dragTo(mode, xy)
      return 'grabbing'
    }
    if (mode.kind === 'placing') {
      if (mode.pane === pane) preview(mode, xy)
      return 'crosshair'
    }
    if (tool !== 'cursor') return 'crosshair'
    return hitAt(pane, xy) || levelAt(pane, xy) !== null ? 'pointer' : 'default'
  }

  const pointerUp = (pane: PaneId, xy: XY): void => {
    if (mode.kind === 'dragging') {
      mode = IDLE
      return
    }
    if (mode.kind === 'measuring') {
      if (pane === MEASURE_PANE && Math.hypot(xy.x - mode.start.x, xy.y - mode.start.y) > RELEASE_DISTANCE) finishMeasuring(mode, xy)
      return
    }
    if (mode.kind !== 'placing' || mode.pane !== pane) return
    const moved = Math.hypot(xy.x - mode.start.x, xy.y - mode.start.y)
    if (moved > RELEASE_DISTANCE) advance(mode, xy)
  }

  const click = (pane: PaneId, xy: XY): void => {
    const level = tool === 'cursor' && mode.kind === 'idle' && !hitAt(pane, xy) ? levelAt(pane, xy) : null
    if (level === null || !deps.levelLook) return
    const look = deps.levelLook()
    add(withLook({ ...baseOf(pane, look), kind: 'hline', value: level }, look))
  }

  const cancel = (): void => {
    if (mode.kind !== 'dragging') return
    const { original } = mode
    mode = IDLE
    if (!deps.getLines().includes(original)) replace(withAlertOf(original, storedOf(original)))
  }

  const key = (pressed: 'Escape' | 'Delete'): void => {
    if (pressed === 'Escape' && (mode.kind === 'measuring' || measured)) {
      clearMeasure()
      tool = 'cursor'
      deps.onToolDone()
      return
    }
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
    click,
    key,
    cancel,
    select,
    clearMeasure,
    syncVisibility,
    getSelectedId: () => selectedId,
  }
}
