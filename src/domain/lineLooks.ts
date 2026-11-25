import type { Drawing, DrawingKind, LineLook } from '../../shared/types'

export const kindOf = (drawing: Drawing): DrawingKind => drawing.kind ?? 'trend'

const strokeOf = (look: LineLook) => ({
  color: look.color,
  width: look.width,
  ...(look.lineStyle ? { lineStyle: look.lineStyle } : {}),
  ...(look.opacity !== undefined ? { opacity: look.opacity } : {}),
})

export const lookOf = (drawing: Drawing): LineLook => ({
  ...strokeOf(drawing),
  ...(drawing.kind === 'hline' && drawing.hidePrice ? { hidePrice: true as const } : {}),
})

export const withLook = (drawing: Drawing, look: LineLook): Drawing => {
  const { lineStyle: _stroke, opacity: _opacity, ...plain } = drawing
  const styled = { ...plain, ...strokeOf(look) } as Drawing
  if (styled.kind !== 'hline') return styled
  const { hidePrice: _hidden, ...shown } = styled
  return look.hidePrice ? { ...shown, hidePrice: true as const } : shown
}

export const sameLook = (first: LineLook | undefined, second: LineLook): boolean =>
  first !== undefined &&
  first.color === second.color &&
  first.width === second.width &&
  first.lineStyle === second.lineStyle &&
  first.opacity === second.opacity &&
  first.hidePrice === second.hidePrice

export const changedLook = (before: Drawing, after: Drawing): LineLook | null => {
  const look = lookOf(after)
  return sameLook(lookOf(before), look) ? null : look
}
