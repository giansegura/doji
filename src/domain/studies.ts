import { ema, sma } from '../../shared/rsi'

type Series = (number | null)[]

export type Bands = { basis: Series; upper: Series; lower: Series }

export type Macd = { macd: Series; signal: Series; histogram: Series }

const both = (a: Series, b: Series, combine: (x: number, y: number) => number): Series =>
  a.map((value, index) => {
    const other = b[index]
    return value === null || other === null || other === undefined ? null : combine(value, other)
  })


const deviation = (values: number[], length: number): Series => {
  let sum = 0
  let squares = 0
  return values.map((value, index) => {
    const leaving = index >= length ? values[index - length] : 0
    sum += value - leaving
    squares += value * value - leaving * leaving
    if (index + 1 < length) return null
    const mean = sum / length
    return Math.sqrt(Math.max(squares / length - mean * mean, 0))
  })
}

export const bollinger = (closes: number[], length: number, multiplier: number): Bands => {
  const basis = sma(closes, length)
  const spread = deviation(closes, length)
  return {
    basis,
    upper: both(basis, spread, (mean, sigma) => mean + sigma * multiplier),
    lower: both(basis, spread, (mean, sigma) => mean - sigma * multiplier),
  }
}

export const macd = (closes: number[], fast: number, slow: number, signalLength: number): Macd => {
  const line = both(ema(closes, fast), ema(closes, slow), (quick, steady) => quick - steady)
  const signal = ema(line, signalLength)
  return { macd: line, signal, histogram: both(line, signal, (gap, average) => gap - average) }
}
