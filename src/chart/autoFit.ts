import type { PaneId } from '../../shared/types'

export type FittedScale = {
  isAuto: () => boolean
  setAuto: (auto: boolean) => void
}

export type AutoFit = {
  release: (pane: PaneId) => void
  fit: () => void
  sync: () => void
}

type AutoFitDeps = {
  panes: PaneId[]
  scale: (pane: PaneId) => FittedScale | null
  onChange: (manual: boolean) => void
}

const notNull = <T>(value: T | null): value is T => value !== null

export const createAutoFit = (deps: AutoFitDeps): AutoFit => {
  const free = (): FittedScale[] =>
    deps.panes
      .map(deps.scale)
      .filter(notNull)
      .filter((scale) => !scale.isAuto())

  const sync = (): void => deps.onChange(free().length > 0)

  const release = (pane: PaneId): void => {
    const scale = deps.scale(pane)
    if (scale?.isAuto()) scale.setAuto(false)
    sync()
  }

  const fit = (): void => {
    free().forEach((scale) => scale.setAuto(true))
    sync()
  }

  return { release, fit, sync }
}
