import { mondayOf } from './dates'
import { priceDigits } from './symbols'
import type { Bar } from './types'

export type Level = { price: number; touches: number; both: boolean; ath: boolean }

export type Levels = { price: number; tolerance: number; resistances: Level[]; supports: Level[] }

type Unit = { high: number; low: number; close: number; volume: number }

type Pivot = { price: number }

type Zone = { price: number; touches: number; score: number; both: boolean; ath: boolean }

const REACH = 5
const DAILY_REACH = 3
const LONG_HISTORY_WEEKS = 104
const MIN_UNITS = 30
const DAILY_BACKUP_BARS = 504
const WINDOW = 0.3
const ATH_REACH = 0.15
const RECENT_WEEKS = 156
const VOLUME_SPAN = 26
const ROLE_BONUS = 1.5
const TIERS = [3, 2, 1]
const MIN_TOLERANCE = 0.005
const MAX_TOLERANCE = 0.05
const DAYS_PER_WEEK = 5

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]
}

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high)

const unitOf = (bar: Bar): Unit => ({ high: bar.high, low: bar.low, close: bar.close, volume: bar.volume ?? 0 })

const weeksOf = (bars: Bar[]): Unit[] => {
  const weeks: Unit[] = []
  let current = ''
  bars.forEach((bar) => {
    const start = mondayOf(bar.time)
    const last = weeks.at(-1)
    if (last && start === current) {
      last.high = Math.max(last.high, bar.high)
      last.low = Math.min(last.low, bar.low)
      last.close = bar.close
      last.volume += bar.volume ?? 0
      return
    }
    current = start
    weeks.push(unitOf(bar))
  })
  return weeks
}

const toleranceOf = (weeks: Unit[]): number =>
  clamp(median(weeks.slice(-LONG_HISTORY_WEEKS).map((week) => (week.high - week.low) / week.close)) / 2, MIN_TOLERANCE, MAX_TOLERANCE)

const recency = (age: number): number => (age <= RECENT_WEEKS ? 1 : Math.max(0.25, RECENT_WEEKS / age))

const volumeFactor = (units: Unit[], index: number): number => {
  const around = median(units.slice(Math.max(index - VOLUME_SPAN, 0), index + VOLUME_SPAN).map((unit) => unit.volume))
  return around > 0 ? clamp(units[index].volume / around, 0.5, 3) : 1
}

const pivotsOf = (units: Unit[], reach: number): Pivot[] => {
  const pivots: Pivot[] = []
  for (let index = reach; index < units.length - reach; index += 1) {
    const left = units.slice(index - reach, index)
    const right = units.slice(index + 1, index + 1 + reach)
    const unit = units[index]
    if (unit.high > Math.max(...left.map((other) => other.high)) && unit.high >= Math.max(...right.map((other) => other.high)))
      pivots.push({ price: unit.high })
    if (unit.low < Math.min(...left.map((other) => other.low)) && unit.low <= Math.min(...right.map((other) => other.low)))
      pivots.push({ price: unit.low })
  }
  return pivots
}

const clustersOf = (pivots: Pivot[], tolerance: number): number[] => {
  const groups: Pivot[][] = []
  ;[...pivots]
    .sort((a, b) => a.price - b.price)
    .forEach((pivot) => {
      const group = groups.at(-1)
      const mean = group ? group.reduce((sum, item) => sum + item.price, 0) / group.length : 0
      if (group && pivot.price <= mean * (1 + tolerance)) group.push(pivot)
      else groups.push([pivot])
    })
  return groups.map((group) => group.reduce((sum, pivot) => sum + pivot.price, 0) / group.length)
}

const zoneAt = (units: Unit[], price: number, tolerance: number, unitsPerWeek: number): Zone => {
  const low = price * (1 - tolerance)
  const high = price * (1 + tolerance)
  let touches = 0
  let score = 0
  let rejected = false
  let held = false
  let touching = false
  units.forEach((unit, index) => {
    const fromBelow = unit.high >= low && unit.high <= high && unit.close < price
    const fromAbove = unit.low >= low && unit.low <= high && unit.close > price
    const touch = fromBelow || fromAbove
    if (touch && !touching) {
      touches += 1
      score += recency((units.length - 1 - index) / unitsPerWeek) * volumeFactor(units, index)
    }
    rejected ||= fromBelow
    held ||= fromAbove
    touching = touch
  })
  const both = rejected && held
  return { price, touches, score: score * (both ? ROLE_BONUS : 1), both, ath: false }
}

const zonesOf = (units: Unit[], reach: number, tolerance: number, unitsPerWeek: number): Zone[] =>
  clustersOf(pivotsOf(units, reach), tolerance).map((price) => zoneAt(units, price, tolerance, unitsPerWeek))

const pick = (zones: Zone[], wanted: number, tolerance: number, taken: Zone[]): Zone[] => {
  const chosen: Zone[] = []
  const apart = (zone: Zone): boolean =>
    [...taken, ...chosen].every((other) => Math.abs(other.price - zone.price) > Math.min(other.price, zone.price) * tolerance * 2)
  TIERS.forEach((tier) => {
    zones
      .filter((zone) => zone.touches >= tier && !chosen.includes(zone))
      .sort((a, b) => b.score - a.score)
      .forEach((zone) => {
        if (chosen.length < wanted && apart(zone)) chosen.push(zone)
      })
  })
  return chosen
}

const toLevel = (symbol: string, zone: Zone): Level => ({
  price: Number(zone.price.toFixed(priceDigits(symbol, zone.price))),
  touches: zone.touches,
  both: zone.both,
  ath: zone.ath,
})

export const supportsAndResistances = (symbol: string, bars: Bar[], perSide: number): Levels | null => {
  const weeks = weeksOf(bars)
  const weekly = weeks.length >= LONG_HISTORY_WEEKS
  const units = weekly ? weeks : bars.map(unitOf)
  const price = bars.at(-1)?.close ?? 0
  if (units.length < MIN_UNITS || weeks.length < 2 || price <= 0) return null
  const tolerance = toleranceOf(weeks)
  const allTimeHigh = Math.max(...weeks.map((week) => week.high))
  const athZone: Zone | null =
    allTimeHigh > price * (1 + tolerance) && allTimeHigh <= price * (1 + ATH_REACH)
      ? { price: allTimeHigh, touches: 1, score: Number.POSITIVE_INFINITY, both: false, ath: true }
      : null
  const notAth = (zone: Zone): boolean => !athZone || Math.abs(zone.price - athZone.price) > athZone.price * tolerance
  const zones = zonesOf(units, weekly ? REACH : DAILY_REACH, tolerance, weekly ? 1 : DAYS_PER_WEEK).filter(notAth)
  const backup = weekly ? zonesOf(bars.slice(-DAILY_BACKUP_BARS).map(unitOf), DAILY_REACH, tolerance, DAYS_PER_WEEK).filter(notAth) : []
  const isAbove = (zone: Zone): boolean => zone.price > price && zone.price <= price * (1 + WINDOW)
  const isBelow = (zone: Zone): boolean => zone.price <= price && zone.price >= price * (1 - WINDOW)
  const fill = (wanted: number, side: (zone: Zone) => boolean, taken: Zone[]): Zone[] => {
    const first = pick(zones.filter(side), wanted, tolerance, taken)
    return [...first, ...pick(backup.filter(side), wanted - first.length, tolerance, [...taken, ...first])]
  }
  const resistances = athZone && perSide > 0 ? [athZone, ...fill(perSide - 1, isAbove, [athZone])] : fill(perSide, isAbove, [])
  return {
    price,
    tolerance,
    resistances: resistances.map((zone) => toLevel(symbol, zone)).sort((a, b) => a.price - b.price),
    supports: fill(perSide, isBelow, [])
      .map((zone) => toLevel(symbol, zone))
      .sort((a, b) => b.price - a.price),
  }
}
