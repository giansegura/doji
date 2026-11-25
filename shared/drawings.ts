import type { Drawing, HorizontalLine, Position, TrendLine } from './types'

export type Alertable = TrendLine | HorizontalLine | Position

export const isTrend = (drawing: Drawing): drawing is TrendLine => drawing.kind === undefined || drawing.kind === 'trend'

export const canAlert = (drawing: Drawing): drawing is Alertable => isTrend(drawing) || drawing.kind === 'hline' || drawing.kind === 'position'

export const withoutAlert = (drawing: Drawing): Drawing => {
  if (!canAlert(drawing)) return drawing
  const { alert: _alert, alertRepeat: _repeat, alertUntil: _until, alertFiredOn: _firedOn, ...quiet } = drawing
  return quiet as Drawing
}

export const afterFiring = (drawing: Drawing, today: string): Drawing =>
  canAlert(drawing) && drawing.alertRepeat ? { ...drawing, alertFiredOn: today } : withoutAlert(drawing)

export const expiredAlert = (drawing: Drawing, today: string): boolean =>
  canAlert(drawing) && drawing.alert === true && drawing.alertUntil !== undefined && today > drawing.alertUntil
