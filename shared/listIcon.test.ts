import { expect, test } from 'vitest'
import { LIST_ICONS, LIST_ICON_GROUPS, toListIcon } from './listIcon'

test('Should keep a single emoji as the icon of a watchlist', () => {
  expect(toListIcon('🏦')).toBe('🏦')
  expect(toListIcon('  🚀 ')).toBe('🚀')
})

test('Should keep emojis made of several characters whole', () => {
  expect(toListIcon('🇪🇸')).toBe('🇪🇸')
  expect(toListIcon('🛢️')).toBe('🛢️')
  expect(toListIcon('👨‍💻')).toBe('👨‍💻')
})

test('Should keep only the first emoji of a longer text', () => {
  expect(toListIcon('🏦💰')).toBe('🏦')
  expect(toListIcon('🇺🇸 bancos')).toBe('🇺🇸')
})

test('Should have no icon for an empty text or something that is not text', () => {
  expect(toListIcon('')).toBeNull()
  expect(toListIcon('   ')).toBeNull()
  expect(toListIcon(null)).toBeNull()
  expect(toListIcon(7)).toBeNull()
})

test('Should offer a large palette of different valid icons', () => {
  expect(LIST_ICONS.length).toBeGreaterThanOrEqual(140)
  expect(new Set(LIST_ICONS).size).toBe(LIST_ICONS.length)
  LIST_ICONS.forEach((icon) => expect(toListIcon(icon)).toBe(icon))
})

test('Should sort the palette into named groups that hold every icon once', () => {
  expect(LIST_ICON_GROUPS.map((group) => group.name)).toEqual(['Markets', 'Sectors', 'Countries', 'Colours and signs', 'Animals'])
  expect(LIST_ICON_GROUPS.flatMap((group) => group.icons)).toEqual(LIST_ICONS)
  LIST_ICON_GROUPS.forEach((group) => expect(group.icons.length).toBeGreaterThanOrEqual(10))
})
