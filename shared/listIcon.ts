const MAX_ICON_UNITS = 16

export const LIST_ICONS = [
  '⭐',
  '🔥',
  '🚀',
  '💎',
  '📈',
  '📉',
  '💰',
  '🏦',
  '💻',
  '🤖',
  '⚡',
  '🛢️',
  '🏭',
  '🏠',
  '🛒',
  '🍔',
  '💊',
  '🚗',
  '✈️',
  '🎮',
  '🌱',
  '🪙',
  '🇺🇸',
  '🇪🇸',
]

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export const toListIcon = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const [first] = segmenter.segment(raw.trim())
  const icon = first?.segment ?? ''
  return icon && icon.length <= MAX_ICON_UNITS && icon.trim() ? icon : null
}
