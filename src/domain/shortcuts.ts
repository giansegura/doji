import type { Tool } from '../state/appReducer'

export type KeyLike = {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export type Shortcut =
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'tool'; tool: Tool }
  | { kind: 'step'; by: 1 | -1 }

const TOOL_KEYS: Record<string, Tool> = { KeyT: 'trendline', KeyH: 'hline', KeyC: 'channel', KeyR: 'rect', KeyM: 'measure' }
const STEPS: Record<string, 1 | -1> = { ArrowDown: 1, ArrowUp: -1 }

const editShortcut = (event: KeyLike): Shortcut | null => {
  if (event.code === 'KeyZ') return { kind: event.shiftKey ? 'redo' : 'undo' }
  return event.code === 'KeyY' ? { kind: 'redo' } : null
}

export const shortcutFor = (event: KeyLike, isTyping: boolean): Shortcut | null => {
  const command = event.metaKey || event.ctrlKey
  const tool = TOOL_KEYS[event.code]
  const step = STEPS[event.key]
  if (isTyping) return null
  if (command) return event.altKey ? null : editShortcut(event)
  if (event.altKey) return tool ? { kind: 'tool', tool } : null
  return step && !event.shiftKey ? { kind: 'step', by: step } : null
}

export const stepSymbol = (symbols: string[], current: string, by: 1 | -1): string | null => {
  const index = symbols.findIndex((symbol) => symbol.toUpperCase() === current.toUpperCase())
  const outside = by === 1 ? symbols[0] : symbols.at(-1)
  if (index < 0) return outside ?? null
  return symbols[index + by] ?? null
}
