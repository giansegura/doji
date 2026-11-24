import type { Logical } from 'lightweight-charts'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Drawing, PaneId, Timeframe } from '../../shared/types'
import { newId } from '../domain/newId'
import { isTyping } from '../domain/typing'
import type { Tool } from '../state/appReducer'
import {
  type CursorKind,
  type Draft,
  type PaneGeometry,
  createDrawingController,
  isLineVisible,
} from './drawingController'
import { DRAFT_ID, type ShapeView, draftDrawing, viewOf } from './drawingViews'
import { type DrawingsPrimitive, createDrawingsPrimitive } from './drawingsPrimitive'
import { createPaneGeometry } from './paneGeometry'
import { type PaneBox, createPointerSession } from './pointerSession'
import type { ChartHandles } from './useChart'

type UseDrawingArgs = {
  handles: ChartHandles | null
  symbol: string
  lines: Drawing[]
  timeframe: Timeframe
  rsiVisible: boolean
  tool: Tool
  onToolDone: () => void
  onLinesChange: (lines: Drawing[]) => void
  onVerticalDrag: (pane: PaneId) => void
  defaultColor: string
  handleFill: string
  priceBasis: string
}

const PANES: PaneId[] = ['price', 'rsi']
const DEFAULT_WIDTH = 2

const notNull = <T>(value: T | null): value is T => value !== null

export const useDrawing = (args: UseDrawingArgs) => {
  const { handles, symbol, lines, timeframe, rsiVisible, tool, onLinesChange, handleFill } = args
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const latest = useRef(args)
  const draftRef = useRef<Draft | null>(null)
  const selectedRef = useRef<string | null>(null)
  const primitivesRef = useRef<DrawingsPrimitive[]>([])
  const container = handles?.container ?? null
  const main = handles?.main ?? null
  const rsi = handles?.rsi ?? null

  const [tools] = useState(() => {
    const redraw = () => primitivesRef.current.forEach((primitive) => primitive.redraw())

    const seriesFor = (pane: PaneId) => (pane === 'price' ? latest.current.handles?.main : latest.current.handles?.rsi) ?? null

    const geometryFor = (pane: PaneId): PaneGeometry | null => {
      const current = latest.current.handles
      const series = seriesFor(pane)
      if (!current || !series) return null
      const timeScale = current.chart.timeScale()
      return createPaneGeometry({
        logicalToCoordinate: (index) => timeScale.logicalToCoordinate(index as Logical),
        valueToCoordinate: (value) => series.priceToCoordinate(value),
        coordinateToValue: (y) => series.coordinateToPrice(y),
        width: timeScale.width(),
        timeIndex: current.timeIndex,
      })
    }

    const viewsFor = (pane: PaneId): ShapeView[] => {
      const geometry = geometryFor(pane)
      if (!geometry) return []
      const current = latest.current
      const draft = draftRef.current
      const saved = current.lines.filter(
        (line) => line.pane === pane && isLineVisible(line, current.timeframe, current.rsiVisible),
      )
      const style = { timeframe: current.timeframe, color: current.defaultColor, width: DEFAULT_WIDTH, pricedAt: current.priceBasis }
      const drafted = draft && draft.pane === pane ? [draftDrawing(draft, style)] : []
      return [...saved, ...drafted]
        .map((drawing) => viewOf(drawing, geometry, drawing.id === selectedRef.current || drawing.id === DRAFT_ID))
        .filter(notNull)
    }

    const measure = (pane: PaneId): PaneBox | null => {
      const current = latest.current.handles
      if (!current || !seriesFor(pane)) return null
      const rect = current.chart.panes()[PANES.indexOf(pane)]?.getHTMLElement()?.getBoundingClientRect()
      if (!rect) return null
      return { left: rect.left, top: rect.top, width: current.chart.timeScale().width(), height: rect.height }
    }

    const controller = createDrawingController({
      getLines: () => latest.current.lines,
      getTimeframe: () => latest.current.timeframe,
      isRsiVisible: () => latest.current.rsiVisible,
      geometry: geometryFor,
      onLinesChange: (next) => {
        latest.current = { ...latest.current, lines: next }
        latest.current.onLinesChange(next)
        redraw()
      },
      onSelect: (id) => {
        selectedRef.current = id
        setSelectedId(id)
        redraw()
      },
      onDraft: (draft) => {
        draftRef.current = draft
        redraw()
      },
      onToolDone: () => latest.current.onToolDone(),
      newId,
      priceBasis: () => latest.current.priceBasis,
      defaults: { color: latest.current.defaultColor, width: DEFAULT_WIDTH },
    })

    return { controller, redraw, viewsFor, measure }
  })

  useEffect(() => {
    latest.current = args
  })

  useEffect(() => {
    tools.controller.setTool(tool)
  }, [tools, tool])

  useEffect(() => {
    tools.controller.setTool(latest.current.tool)
    tools.controller.select(null)
  }, [tools, symbol])

  useEffect(() => {
    if (!main) return undefined
    const fill = () => latest.current.handleFill
    const attachments = [
      { series: main, primitive: createDrawingsPrimitive(() => tools.viewsFor('price'), fill) },
      ...(rsi ? [{ series: rsi, primitive: createDrawingsPrimitive(() => tools.viewsFor('rsi'), fill) }] : []),
    ]
    attachments.forEach(({ series, primitive }) => series.attachPrimitive(primitive))
    primitivesRef.current = attachments.map(({ primitive }) => primitive)
    return () => {
      primitivesRef.current = []
      if (!handles?.isAlive()) return
      attachments.forEach(({ series, primitive }) => {
        try {
          series.detachPrimitive(primitive)
        } catch {
          return
        }
      })
    }
  }, [tools, main, rsi])

  useEffect(() => {
    tools.controller.syncVisibility()
  }, [tools, lines, timeframe, rsiVisible])

  useEffect(() => {
    tools.redraw()
  }, [tools, lines, timeframe, rsiVisible, handleFill, handles, selectedId])

  useEffect(() => {
    if (!container) return undefined
    const session = createPointerSession({
      controller: tools.controller,
      panes: PANES,
      measure: tools.measure,
      isInside: (target) => target instanceof Node && container.contains(target),
      setCursor: (cursor: CursorKind) => {
        if (cursor === 'default') delete container.dataset.cursor
        else container.dataset.cursor = cursor
      },
      onVerticalDrag: (pane) => latest.current.onVerticalDrag(pane),
    })

    const handleKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      if (event.key === 'Escape') tools.controller.key('Escape')
      if (event.key === 'Delete' || event.key === 'Backspace') tools.controller.key('Delete')
    }

    container.addEventListener('pointerdown', session.down, true)
    container.addEventListener('mousedown', session.mouseDown, true)
    window.addEventListener('pointermove', session.move)
    window.addEventListener('pointerup', session.up)
    window.addEventListener('pointercancel', session.cancel)
    window.addEventListener('keydown', handleKey)
    return () => {
      container.removeEventListener('pointerdown', session.down, true)
      container.removeEventListener('mousedown', session.mouseDown, true)
      window.removeEventListener('pointermove', session.move)
      window.removeEventListener('pointerup', session.up)
      window.removeEventListener('pointercancel', session.cancel)
      window.removeEventListener('keydown', handleKey)
      delete container.dataset.cursor
    }
  }, [tools, container])

  const selectedLine =
    lines.find((line) => line.id === selectedId && isLineVisible(line, timeframe, rsiVisible)) ?? null

  const updateLine = useCallback(
    (updated: Drawing) => onLinesChange(lines.map((line) => (line.id === updated.id ? updated : line))),
    [lines, onLinesChange],
  )

  const deleteSelected = useCallback(() => tools.controller.key('Delete'), [tools])

  return { selectedLine, updateLine, deleteSelected }
}
