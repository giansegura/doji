import type { IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, SeriesType, Time } from 'lightweight-charts'
import { type Profile, profileLayout } from './volumeProfile'

export type ProfileColors = { up: string; down: string; poc: string }

type ProfileSource = { profile: () => Profile | null; colors: () => ProfileColors }

export type VolumeProfilePrimitive = ISeriesPrimitive<Time> & { redraw: () => void }

const INSIDE_ALPHA = 0.45
const OUTSIDE_ALPHA = 0.2
const POC_ALPHA = 0.8

export const createVolumeProfilePrimitive = (source: ProfileSource): VolumeProfilePrimitive => {
  let series: Pick<ISeriesApi<SeriesType>, 'priceToCoordinate'> | null = null
  let requestUpdate: (() => void) | null = null

  const renderer: IPrimitivePaneRenderer = {
    draw: (target) => {
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const profile = source.profile()
        const current = series
        if (!profile || !current) return
        const colors = source.colors()
        const layout = profileLayout(profile, (price) => current.priceToCoordinate(price), mediaSize.width)
        context.save()
        layout.boxes.forEach((box) => {
          context.globalAlpha = box.inside ? INSIDE_ALPHA : OUTSIDE_ALPHA
          context.fillStyle = box.side === 'up' ? colors.up : colors.down
          context.fillRect(box.x, box.y, box.width, box.height)
        })
        if (layout.poc !== null) {
          context.globalAlpha = POC_ALPHA
          context.strokeStyle = colors.poc
          context.lineWidth = 1
          context.beginPath()
          context.moveTo(0, layout.poc)
          context.lineTo(mediaSize.width, layout.poc)
          context.stroke()
        }
        context.restore()
      })
    },
  }

  const view: IPrimitivePaneView = { zOrder: () => 'bottom', renderer: () => renderer }

  return {
    attached: (param) => {
      series = param.series
      requestUpdate = param.requestUpdate
    },
    detached: () => {
      series = null
      requestUpdate = null
    },
    paneViews: () => [view],
    redraw: () => requestUpdate?.(),
  }
}
