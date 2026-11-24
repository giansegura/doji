const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

export const withAlpha = (colour: string, alpha: number): string => {
  const match = HEX.exec(colour)
  if (!match) return colour
  const [red, green, blue] = match.slice(1).map((pair) => Number.parseInt(pair, 16))
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
