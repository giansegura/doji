export type Rgba = [number, number, number, number]

export type LogoShape = 'tile' | 'mark' | 'pale'

export type PixelAt = (x: number, y: number) => Rgba

type Point = [number, number]

export const LOGO_SAMPLE = 32

const LAST = LOGO_SAMPLE - 1
const CENTRE = LAST / 2
const INNER_RADIUS = LOGO_SAMPLE / 2 - 1
const OPAQUE_FROM = 128
const WHITE_FROM = 250
const LIGHT_FROM = 220
const FILLED_SHARE = 0.95
const PALE_SHARE = 0.6
const CORNERS: Point[] = [
  [0, 0],
  [LAST, 0],
  [0, LAST],
  [LAST, LAST],
]
const GRID: Point[] = Array.from({ length: LOGO_SAMPLE * LOGO_SAMPLE }, (_, index) => [
  index % LOGO_SAMPLE,
  Math.floor(index / LOGO_SAMPLE),
])
const INSIDE_CIRCLE = GRID.filter(([x, y]) => Math.hypot(x - CENTRE, y - CENTRE) <= INNER_RADIUS)

const isOpaque = (pixel: Rgba): boolean => pixel[3] >= OPAQUE_FROM

const isWhite = ([red, green, blue]: Rgba): boolean => red >= WHITE_FROM && green >= WHITE_FROM && blue >= WHITE_FROM

const isLight = ([red, green, blue]: Rgba): boolean => 0.2126 * red + 0.7152 * green + 0.0722 * blue >= LIGHT_FROM

const shareOf = <T>(items: T[], matches: (item: T) => boolean): number =>
  items.length === 0 ? 0 : items.filter(matches).length / items.length

export const shapeOf = (pixelAt: PixelAt): LogoShape => {
  const corners = CORNERS.map(([x, y]) => pixelAt(x, y))
  if (corners.every(isOpaque)) return corners.every(isWhite) ? 'mark' : 'tile'
  if (shareOf(INSIDE_CIRCLE, ([x, y]) => isOpaque(pixelAt(x, y))) >= FILLED_SHARE) return 'tile'
  const ink = GRID.map(([x, y]) => pixelAt(x, y)).filter(isOpaque)
  return corners.some(isOpaque) || shareOf(ink, isLight) < PALE_SHARE ? 'mark' : 'pale'
}

export const readShape = (image: HTMLImageElement): LogoShape => {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = LOGO_SAMPLE
    canvas.height = LOGO_SAMPLE
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return 'mark'
    context.drawImage(image, 0, 0, LOGO_SAMPLE, LOGO_SAMPLE)
    const { data } = context.getImageData(0, 0, LOGO_SAMPLE, LOGO_SAMPLE)
    return shapeOf((x, y) => {
      const at = (y * LOGO_SAMPLE + x) * 4
      return [data[at], data[at + 1], data[at + 2], data[at + 3]]
    })
  } catch {
    return 'mark'
  }
}
