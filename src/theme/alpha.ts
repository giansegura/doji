const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

export const withAlpha = (colour: string, alpha: number): string => {
  const match = HEX.exec(colour)
  if (!match) return colour
  const [red, green, blue] = match.slice(1).map((pair) => Number.parseInt(pair, 16))
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const LIGHT_TEXT = '#FFFFFF'
const DARK_TEXT = '#0E0D0C'
const BRIGHT = 0.7

export const textOn = (colour: string): string => {
  const match = HEX.exec(colour)
  if (!match) return LIGHT_TEXT
  const [red, green, blue] = match.slice(1).map((pair) => Number.parseInt(pair, 16))
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > BRIGHT ? DARK_TEXT : LIGHT_TEXT
}
