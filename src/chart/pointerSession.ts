import type { PaneId } from '../../shared/types'
import type { CursorKind, DrawingController } from './drawingController'
import type { XY } from './lineGeometry'

export type PaneBox = { left: number; top: number; width: number; height: number }

export type PointerLike = {
  button: number
  buttons: number
  clientX: number
  clientY: number
  target: EventTarget | null
  stopPropagation: () => void
  preventDefault: () => void
}

export type PointerSession = {
  down: (event: PointerLike) => void
  mouseDown: (event: Pick<PointerLike, 'stopPropagation'>) => void
  move: (event: PointerLike) => void
  up: (event: PointerLike) => void
  cancel: () => void
}

type SessionDeps = {
  controller: Pick<DrawingController, 'pointerDown' | 'pointerMove' | 'pointerUp' | 'cancel' | 'click'>
  panes: PaneId[]
  measure: (pane: PaneId) => PaneBox | null
  isInside: (target: EventTarget | null) => boolean
  setCursor: (cursor: CursorKind) => void
  onVerticalDrag: (pane: PaneId) => void
}

type Located = { pane: PaneId; xy: XY }

type Press = { pane: PaneId; x: number; y: number }

const DRAG_START_PX = 5

const offsetIn = (box: PaneBox, event: PointerLike): XY => ({ x: event.clientX - box.left, y: event.clientY - box.top })

const isWithin = (box: PaneBox, xy: XY): boolean => xy.x >= 0 && xy.x <= box.width && xy.y >= 0 && xy.y <= box.height

export const createPointerSession = (deps: SessionDeps): PointerSession => {
  let captured: PaneId | null = null
  let swallowMouse = false
  let pressed: Press | null = null

  const locate = (event: PointerLike): Located | null => {
    for (const pane of deps.panes) {
      const box = deps.measure(pane)
      const xy = box ? offsetIn(box, event) : null
      if (box && xy && isWithin(box, xy)) return { pane, xy }
    }
    return null
  }

  const follow = (pane: PaneId, event: PointerLike): Located | null => {
    const box = deps.measure(pane)
    return box ? { pane, xy: offsetIn(box, event) } : null
  }

  const place = (event: PointerLike): Located | null => {
    if (captured) return follow(captured, event)
    return deps.isInside(event.target) ? locate(event) : null
  }

  const release = (pane: PaneId, event: PointerLike): void => {
    const at = follow(pane, event)
    captured = null
    swallowMouse = false
    if (at) deps.controller.pointerUp(at.pane, at.xy)
    else deps.controller.cancel()
  }

  const judge = (event: PointerLike): void => {
    if (!pressed) return
    if (event.buttons === 0) {
      pressed = null
      return
    }
    const across = Math.abs(event.clientX - pressed.x)
    const along = Math.abs(event.clientY - pressed.y)
    if (across + along < DRAG_START_PX) return
    const { pane } = pressed
    pressed = null
    if (along > across) deps.onVerticalDrag(pane)
  }

  const down = (event: PointerLike): void => {
    const hit = event.button === 0 ? locate(event) : null
    pressed = null
    if (!hit) return
    if (!deps.controller.pointerDown(hit.pane, hit.xy)) {
      pressed = { pane: hit.pane, x: event.clientX, y: event.clientY }
      return
    }
    captured = hit.pane
    swallowMouse = true
    event.stopPropagation()
    event.preventDefault()
  }

  const mouseDown = (event: Pick<PointerLike, 'stopPropagation'>): void => {
    if (swallowMouse) event.stopPropagation()
  }

  const move = (event: PointerLike): void => {
    if (captured && event.buttons === 0) release(captured, event)
    judge(event)
    const at = place(event)
    deps.setCursor(at ? deps.controller.pointerMove(at.pane, at.xy) : 'default')
  }

  const up = (event: PointerLike): void => {
    const quiet = pressed && Math.abs(event.clientX - pressed.x) + Math.abs(event.clientY - pressed.y) < DRAG_START_PX ? pressed : null
    pressed = null
    if (captured) {
      release(captured, event)
      return
    }
    const at = quiet ? follow(quiet.pane, event) : null
    if (at) deps.controller.click(at.pane, at.xy)
  }

  const cancel = (): void => {
    pressed = null
    captured = null
    swallowMouse = false
    deps.controller.cancel()
    deps.setCursor('default')
  }

  return { down, mouseDown, move, up, cancel }
}
