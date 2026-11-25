import { isSection } from '../../shared/listItems'
import type { FlagColor, ListItem, ListSection } from '../../shared/types'

export const FLAG_NAMES: Record<FlagColor, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
}

export const onlyFlagged = (items: ListItem[], flags: Record<string, FlagColor>): ListItem[] => {
  const kept: ListItem[] = []
  let section: ListSection | null = null
  items.forEach((item) => {
    if (isSection(item)) {
      section = item
      return
    }
    if (!flags[item.symbol]) return
    if (section) kept.push(section)
    section = null
    kept.push(item)
  })
  return kept
}
