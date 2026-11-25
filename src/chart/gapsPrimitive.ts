import type { IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive, Time } from 'lightweight-charts'

export type GapBox = { x: number; top: number; bottom: number; direction: 'up' | 'down' }

type GapsSource = { boxes: () => GapBox[]; colors: () => { up: string; down: string } }

export type GapsPrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

const SHADE = 0.14

export const createGapsPrimitive = (source: GapsSource): GapsPrimitive => {
  let requestUpdate: (() => void) | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: (target) => {
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const colors = source.colors()
        context.save()
        context.globalAlpha = SHADE
        source.boxes().forEach((box) => {
          const top = Math.min(box.top, box.bottom)
          context.fillStyle = colors[box.direction]
          context.fillRect(box.x, top, Math.max(mediaSize.width - box.x, 0), Math.abs(box.bottom - box.top))
        })
        context.restore()
      })
    },
  }

  const view: IPrimitivePaneView = { zOrder: () => 'bottom', renderer: () => renderer }

  return {
    attached: (param) => {
      requestUpdate = param.requestUpdate
    },
    detached: () => {
      requestUpdate = null
    },
    paneViews: () => [view],
    redraw: () => requestUpdate?.(),
  }
}
