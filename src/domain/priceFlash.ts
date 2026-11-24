export type PriceFlash = { direction: 'up' | 'down'; from: number }

type ShownPrice = { price: number; text: string }

const firstDifference = (before: string, after: string): number => {
  if (before.length !== after.length) return 0
  const index = [...after].findIndex((character, position) => character !== before[position])
  return Math.max(index, 0)
}

export const priceFlash = (before: ShownPrice, after: ShownPrice): PriceFlash | null => {
  if (after.price === before.price || after.text === before.text) return null
  return { direction: after.price > before.price ? 'up' : 'down', from: firstDifference(before.text, after.text) }
}
