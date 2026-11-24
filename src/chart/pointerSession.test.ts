import { expect, test } from 'vitest'
import type { PaneId } from '../../shared/types'
import type { CursorKind } from './drawingController'
import { type PaneBox, type PointerLike, createPointerSession } from './pointerSession'

type Options = { accepts?: boolean; inside?: boolean; cursor?: CursorKind; boxes?: Partial<Record<PaneId, PaneBox | null>> }

const BOXES: Record<PaneId, PaneBox | null> = {
  price: { left: 100, top: 50, width: 400, height: 300 },
  rsi: { left: 100, top: 360, width: 400, height: 100 },
}

const setup = (options: Options = {}) => {
  const record = {
    calls: [] as string[],
    vertical: [] as PaneId[],
    measured: 0,
    cursor: 'default' as CursorKind,
    stopped: 0,
    prevented: 0,
  }
  const boxes = { ...BOXES, ...options.boxes }
  const session = createPointerSession({
    controller: {
      pointerDown: (pane, xy) => {
        record.calls.push(`down ${pane} ${xy.x},${xy.y}`)
        return options.accepts ?? true
      },
      pointerMove: (pane, xy) => {
        record.calls.push(`move ${pane} ${xy.x},${xy.y}`)
        return options.cursor ?? 'crosshair'
      },
      pointerUp: (pane, xy) => {
        record.calls.push(`up ${pane} ${xy.x},${xy.y}`)
      },
      cancel: () => {
        record.calls.push('cancel')
      },
    },
    panes: ['price', 'rsi'],
    measure: (pane) => {
      record.measured += 1
      return boxes[pane]
    },
    isInside: () => options.inside ?? true,
    setCursor: (cursor) => {
      record.cursor = cursor
    },
    onVerticalDrag: (pane) => {
      record.vertical.push(pane)
    },
  })
  const event = (clientX: number, clientY: number, over: Partial<PointerLike> = {}): PointerLike => ({
    button: 0,
    buttons: 1,
    clientX,
    clientY,
    target: null,
    stopPropagation: () => {
      record.stopped += 1
    },
    preventDefault: () => {
      record.prevented += 1
    },
    ...over,
  })
  return { record, session, event, boxes, options }
}

test('Should hand a press inside a pane to the controller in pane coordinates', () => {
  const { record, session, event } = setup()
  session.down(event(150, 80))
  session.down(event(150, 400))
  expect(record.calls).toEqual(['down price 50,30', 'down rsi 50,40'])
})

test('Should keep a press it took away from the chart', () => {
  const { record, session, event } = setup()
  session.down(event(150, 80))
  expect(record.stopped).toBe(1)
  expect(record.prevented).toBe(1)
})

test('Should leave the press to the chart when the controller does not take it', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 80))
  session.mouseDown(event(150, 80))
  expect(record.stopped).toBe(0)
  expect(record.prevented).toBe(0)
})

test('Should swallow the mouse press that follows a press it took', () => {
  const { record, session, event } = setup()
  session.down(event(150, 80))
  session.mouseDown(event(150, 80))
  expect(record.stopped).toBe(2)
  session.up(event(150, 80))
  session.mouseDown(event(150, 80))
  expect(record.stopped).toBe(2)
})

test('Should ignore presses with other buttons', () => {
  const { record, session, event } = setup()
  session.down(event(150, 80, { button: 2 }))
  expect(record.calls).toEqual([])
})

test('Should ignore a press outside the panes', () => {
  const { record, session, event } = setup()
  session.down(event(520, 80))
  session.down(event(150, 355))
  expect(record.calls).toEqual([])
})

test('Should not pass a release to the controller unless it took the press', () => {
  const { record, session, event } = setup()
  session.up(event(150, 80, { buttons: 0 }))
  expect(record.calls).toEqual([])
})

test('Should not pass the release of a press the controller refused', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 80))
  session.up(event(300, 200, { buttons: 0 }))
  expect(record.calls).toEqual(['down price 50,30'])
})

test('Should pass the release of a press it took, even outside the pane', () => {
  const { record, session, event } = setup()
  session.down(event(150, 80))
  session.up(event(20, 600, { buttons: 0 }))
  expect(record.calls).toEqual(['down price 50,30', 'up price -80,550'])
})

test('Should follow the pane of the gesture while the pointer leaves it', () => {
  const { record, session, event } = setup()
  session.down(event(150, 80))
  session.move(event(150, 400))
  expect(record.calls).toEqual(['down price 50,30', 'move price 50,350'])
})

test('Should end the gesture when the pointer moves with no button held', () => {
  const { record, session, event } = setup()
  session.down(event(150, 80))
  session.move(event(200, 120, { buttons: 0 }))
  session.up(event(200, 120, { buttons: 0 }))
  expect(record.calls).toEqual(['down price 50,30', 'up price 100,70', 'move price 100,70'])
})

test('Should cancel the gesture when the pointer is cancelled', () => {
  const { record, session, event } = setup({ cursor: 'grabbing' })
  session.down(event(150, 80))
  session.move(event(160, 90))
  session.cancel()
  session.up(event(160, 90, { buttons: 0 }))
  session.mouseDown(event(160, 90))
  expect(record.calls).toEqual(['down price 50,30', 'move price 60,40', 'cancel'])
  expect(record.cursor).toBe('default')
  expect(record.stopped).toBe(1)
})

test('Should cancel the gesture when its pane is gone at release', () => {
  const { record, session, event, boxes } = setup()
  session.down(event(150, 400))
  boxes.rsi = null
  session.up(event(150, 400, { buttons: 0 }))
  expect(record.calls).toEqual(['down rsi 50,40', 'cancel'])
})

test('Should set the cursor the controller reports', () => {
  const { record, session, event } = setup({ cursor: 'pointer' })
  session.move(event(150, 80, { buttons: 0 }))
  expect(record.cursor).toBe('pointer')
  session.move(event(520, 80, { buttons: 0 }))
  expect(record.cursor).toBe('default')
})

test('Should not measure while the pointer is outside the chart', () => {
  const { record, session, event } = setup({ inside: false })
  session.move(event(150, 80, { buttons: 0 }))
  expect(record.measured).toBe(0)
  expect(record.calls).toEqual([])
  expect(record.cursor).toBe('default')
})

test('Should measure each pane at most once per move', () => {
  const { record, session, event } = setup()
  session.move(event(150, 80, { buttons: 0 }))
  expect(record.measured).toBe(1)
  session.move(event(150, 400, { buttons: 0 }))
  expect(record.measured).toBe(3)
})

test('Should measure only the pane that holds the gesture', () => {
  const { record, session, event, options } = setup()
  session.down(event(150, 400))
  record.measured = 0
  options.inside = false
  session.move(event(900, 900))
  expect(record.measured).toBe(1)
  expect(record.calls).toEqual(['down rsi 50,40', 'move rsi 800,540'])
})

test('Should report a drag of the chart that starts mostly upwards or downwards', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 80))
  session.move(event(151, 84))
  expect(record.vertical).toEqual(['price'])
})

test('Should report the pane the vertical drag started in', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 400))
  session.move(event(150, 392))
  expect(record.vertical).toEqual(['rsi'])
})

test('Should not report a drag of the chart that starts mostly sideways', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 80))
  session.move(event(154, 81))
  session.move(event(160, 140))
  expect(record.vertical).toEqual([])
})

test('Should treat a diagonal drag as sideways', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 80))
  session.move(event(153, 83))
  expect(record.vertical).toEqual([])
})

test('Should wait until the drag has started before judging its direction', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 80))
  session.move(event(150, 84))
  expect(record.vertical).toEqual([])
  session.move(event(151, 86))
  expect(record.vertical).toEqual(['price'])
})

test('Should report a vertical drag once per press', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 80))
  session.move(event(150, 90))
  session.move(event(150, 120))
  expect(record.vertical).toEqual(['price'])
})

test('Should not report a vertical drag of a press the controller took', () => {
  const { record, session, event } = setup()
  session.down(event(150, 80))
  session.move(event(150, 120))
  expect(record.vertical).toEqual([])
})

test('Should not report a vertical drag that started outside the panes or with another button', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(520, 80))
  session.move(event(520, 120))
  session.down(event(150, 80, { button: 2, buttons: 2 }))
  session.move(event(150, 120, { button: 2, buttons: 2 }))
  expect(record.vertical).toEqual([])
})

test('Should forget the press once the button is released', () => {
  const { record, session, event } = setup({ accepts: false })
  session.down(event(150, 80))
  session.up(event(150, 81, { buttons: 0 }))
  session.move(event(150, 120))
  session.down(event(150, 80))
  session.move(event(150, 82, { buttons: 0 }))
  session.move(event(150, 120))
  session.down(event(150, 80))
  session.cancel()
  session.move(event(150, 120))
  expect(record.vertical).toEqual([])
})
