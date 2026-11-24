export type ProfileBar = { open: number; high: number; low: number; close: number; volume: number }

export type ProfileRow = { low: number; high: number; up: number; down: number }

export type Profile = { rows: ProfileRow[]; poc: number; valueArea: { from: number; to: number } }

const VALUE_AREA = 0.7

const totalOf = (row: ProfileRow): number => row.up + row.down

const rowsBetween = (low: number, high: number, count: number): ProfileRow[] => {
  const step = (high - low) / count
  return Array.from({ length: count }, (_, index) => ({ low: low + index * step, high: low + (index + 1) * step, up: 0, down: 0 }))
}

const spread = (rows: ProfileRow[], bar: ProfileBar, bottom: number, step: number): void => {
  const side = bar.close >= bar.open ? 'up' : 'down'
  const last = rows.length - 1
  const rowOf = (price: number): number => Math.min(Math.max(Math.floor((price - bottom) / step), 0), last)
  const range = bar.high - bar.low
  if (range <= 0) {
    rows[rowOf(bar.low)][side] += bar.volume
    return
  }
  for (let index = rowOf(bar.low); index <= rowOf(bar.high); index += 1) {
    const row = rows[index]
    const overlap = Math.min(bar.high, row.high) - Math.max(bar.low, row.low)
    if (overlap > 0) row[side] += (bar.volume * overlap) / range
  }
}

const pocOf = (rows: ProfileRow[]): number =>
  rows.reduce((best, row, index) => (totalOf(row) > totalOf(rows[best]) ? index : best), 0)

const valueAreaOf = (rows: ProfileRow[], poc: number): { from: number; to: number } => {
  const goal = rows.reduce((sum, row) => sum + totalOf(row), 0) * VALUE_AREA
  let from = poc
  let to = poc
  let held = totalOf(rows[poc])
  while (held < goal && (from > 0 || to < rows.length - 1)) {
    const below = from > 0 ? totalOf(rows[from - 1]) : -1
    const above = to < rows.length - 1 ? totalOf(rows[to + 1]) : -1
    if (above >= below) {
      to += 1
      held += above
    } else {
      from -= 1
      held += below
    }
  }
  return { from, to }
}

export const volumeProfile = (bars: ProfileBar[], count: number): Profile | null => {
  const traded = bars.filter((bar) => bar.volume > 0 && Number.isFinite(bar.high) && Number.isFinite(bar.low))
  if (traded.length === 0) return null
  const bottom = Math.min(...traded.map((bar) => bar.low))
  const top = Math.max(...traded.map((bar) => bar.high))
  if (top <= bottom) return null
  const rows = rowsBetween(bottom, top, count)
  const step = (top - bottom) / count
  traded.forEach((bar) => spread(rows, bar, bottom, step))
  const poc = pocOf(rows)
  return { rows, poc, valueArea: valueAreaOf(rows, poc) }
}

export type ProfileBox = { x: number; y: number; width: number; height: number; side: 'up' | 'down'; inside: boolean }

export type ProfileLayout = { boxes: ProfileBox[]; poc: number | null }

const PROFILE_SHARE = 0.25
const ROW_GAP = 1

export const profileLayout = (profile: Profile, toY: (price: number) => number | null, width: number): ProfileLayout => {
  const widest = Math.max(...profile.rows.map(totalOf))
  const boxes = profile.rows.flatMap((row, index): ProfileBox[] => {
    const top = toY(row.high)
    const bottom = toY(row.low)
    const total = totalOf(row)
    if (top === null || bottom === null || total <= 0 || widest <= 0) return []
    const length = (total / widest) * width * PROFILE_SHARE
    const upLength = (row.up / total) * length
    const y = Math.min(top, bottom) + ROW_GAP
    const height = Math.max(Math.abs(bottom - top) - ROW_GAP * 2, 1)
    const inside = index >= profile.valueArea.from && index <= profile.valueArea.to
    const start = width - length
    const parts: ProfileBox[] = [
      { x: start, y, width: upLength, height, side: 'up', inside },
      { x: start + upLength, y, width: length - upLength, height, side: 'down', inside },
    ]
    return parts.filter((part) => part.width > 0)
  })
  const poc = profile.rows[profile.poc]
  return { boxes, poc: poc ? toY((poc.low + poc.high) / 2) : null }
}
