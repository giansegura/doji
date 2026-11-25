const toRsi = (averageGain: number, averageLoss: number): number => {
  if (averageLoss === 0) return 100
  if (averageGain === 0) return 0
  return 100 - 100 / (1 + averageGain / averageLoss)
}

export const rsi = (closes: number[], length: number): (number | null)[] => {
  const out: (number | null)[] = closes.map(() => null)
  if (closes.length <= length) return out

  let averageGain = 0
  let averageLoss = 0
  for (let i = 1; i <= length; i += 1) {
    const change = closes[i] - closes[i - 1]
    averageGain += Math.max(change, 0) / length
    averageLoss += Math.max(-change, 0) / length
  }
  out[length] = toRsi(averageGain, averageLoss)

  for (let i = length + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1]
    averageGain = (averageGain * (length - 1) + Math.max(change, 0)) / length
    averageLoss = (averageLoss * (length - 1) + Math.max(-change, 0)) / length
    out[i] = toRsi(averageGain, averageLoss)
  }
  return out
}

export const sma = (values: (number | null)[], length: number): (number | null)[] => {
  let sum = 0
  let gaps = 0
  return values.map((value, index) => {
    const leaving = index >= length ? values[index - length] : undefined
    if (value === null) gaps += 1
    else sum += value
    if (leaving === null) gaps -= 1
    else if (leaving !== undefined) sum -= leaving
    return index + 1 < length || gaps > 0 ? null : sum / length
  })
}

export const ema = (values: (number | null)[], length: number): (number | null)[] => {
  const weight = 2 / (length + 1)
  const seed: number[] = []
  let current: number | null = null
  return values.map((value) => {
    if (value === null) return null
    if (current !== null) {
      current = value * weight + current * (1 - weight)
      return current
    }
    seed.push(value)
    if (seed.length < length) return null
    current = seed.reduce((sum, item) => sum + item, 0) / length
    return current
  })
}
