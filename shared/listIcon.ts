const MAX_ICON_UNITS = 16

export const LIST_ICON_GROUPS: { name: string; icons: string[] }[] = [
  { name: 'Markets', icons: ['📈', '📉', '💹', '📊', '💰', '💵', '💶', '💷', '💴', '🪙', '💳', '🏦', '💎', '⚖️', '🧾', '🎯', '🏆', '⭐', '🌟', '🔥', '🚀', '🌙', '☀️', '⚡', '💥', '🛡️', '🔒', '⏳', '🔔', '🧭'] },
  { name: 'Sectors', icons: ['💻', '🖥️', '📱', '🤖', '🧠', '🔌', '🔋', '💾', '📡', '🛰️', '🛢️', '⛽', '☢️', '🌞', '🌬️', '💧', '🏭', '🏗️', '⛏️', '🧪', '🏠', '🏢', '🏨', '🛒', '🛍️', '🍔', '🍕', '☕', '🍺', '🍷', '🥤', '🍫', '💊', '💉', '🧬', '🏥', '🚗', '🚚', '✈️', '🚢', '🚆', '📦', '🎮', '🎬', '🎵', '📺', '👟', '👗', '💄', '⌚', '🌾', '🌲', '🚬', '🎰'] },
  { name: 'Countries', icons: ['🇺🇸', '🇪🇺', '🇪🇸', '🇬🇧', '🇩🇪', '🇫🇷', '🇮🇹', '🇳🇱', '🇵🇹', '🇨🇭', '🇸🇪', '🇳🇴', '🇩🇰', '🇯🇵', '🇨🇳', '🇭🇰', '🇰🇷', '🇹🇼', '🇮🇳', '🇸🇬', '🇧🇷', '🇲🇽', '🇦🇷', '🇨🇦', '🇦🇺', '🇮🇱'] },
  { name: 'Colours and signs', icons: ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '✅', '❌', '⚠️', '❓', '❗', '📌', '🔖', '🏷️', '👀', '💡', '🧩', '♻️', '🆕'] },
  { name: 'Animals', icons: ['🐂', '🐻', '🦅', '🦁', '🐺', '🦊', '🐢', '🐇', '🦄', '🐋', '🦈', '🐝', '🐉', '🦉', '🐎'] },
]

export const LIST_ICONS = LIST_ICON_GROUPS.flatMap((group) => group.icons)

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export const toListIcon = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const [first] = segmenter.segment(raw.trim())
  const icon = first?.segment ?? ''
  return icon && icon.length <= MAX_ICON_UNITS && icon.trim() ? icon : null
}
