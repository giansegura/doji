import type { IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive, Time } from 'lightweight-charts'
import type { EarningsMark } from './earningsMarks'

export type EarningsColors = { past: string; next: string; background: string; text: string; beat?: string; miss?: string }

type EarningsSource = { marks: () => EarningsMark[]; colors: () => EarningsColors }

export type EarningsPrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

const RADIUS = 7
const BOTTOM_GAP = 10
const ROW_GAP = 17
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
        source.marks().forEach(({ x, kind, row = 0, tone }) => {
          const top = y - row * ROW_GAP
          const hollow = kind === 'next'
          context.beginPath()
          context.arc(x, top, RADIUS, 0, FULL_CIRCLE)
          context.fillStyle = hollow ? colors.background : ((tone && colors[tone]) ?? colors.past)
          context.fill()
          if (hollow) {
            context.strokeStyle = colors.next
            context.stroke()
          }
          context.fillStyle = hollow ? colors.next : colors.text
          context.fillText(kind === 'dividend' ? 'D' : 'E', x, top)
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
