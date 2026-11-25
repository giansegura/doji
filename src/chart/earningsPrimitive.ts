import type { IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive, Time } from 'lightweight-charts'
import type { EarningsMark } from './earningsMarks'

export type EarningsColors = { past: string; next: string; background: string; text: string }

type EarningsSource = { marks: () => EarningsMark[]; colors: () => EarningsColors }

export type EarningsPrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

const RADIUS = 7
const BOTTOM_GAP = 10
const FULL_CIRCLE = Math.PI * 2
const FONT = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export const createEarningsPrimitive = (source: EarningsSource): EarningsPrimitive => {
  let requestUpdate: (() => void) | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: (target) => {
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const colors = source.colors()
        const y = mediaSize.height - BOTTOM_GAP
        context.save()
        context.font = FONT
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.lineWidth = 1.5
        source.marks().forEach(({ x, kind }) => {
          context.beginPath()
          context.arc(x, y, RADIUS, 0, FULL_CIRCLE)
          context.fillStyle = kind === 'past' ? colors.past : colors.background
          context.fill()
          if (kind === 'next') {
            context.strokeStyle = colors.next
            context.stroke()
          }
          context.fillStyle = kind === 'past' ? colors.text : colors.next
          context.fillText('E', x, y)
        })
        context.restore()
      })
    },
  }

  const view: IPrimitivePaneView = { zOrder: () => 'top', renderer: () => renderer }

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
