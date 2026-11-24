export type HoverStore = {
  get: () => number | null
  set: (index: number | null) => void
  subscribe: (listener: () => void) => () => void
}

export const createHoverStore = (): HoverStore => {
  const listeners = new Set<() => void>()
  let hovered: number | null = null

  const set = (index: number | null): void => {
    if (index === hovered) return
    hovered = index
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return { get: () => hovered, set, subscribe }
}
