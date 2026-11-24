import { SYMBOL_PATTERN } from '../../shared/symbols'
import type { LiveTick, TickSession } from '../../shared/types'

type FieldValue = bigint | number | Uint8Array

const MAX_BYTES = 2048
const MAX_VARINT_BYTES = 10
const SIGNIFICANT_DIGITS = 7
const VARINT = 0
const FIXED_64 = 1
const BYTES = 2
const FIXED_32 = 5
const FIELD = { symbol: 1, price: 2, time: 3, marketHours: 7, changePercent: 8, volume: 9, change: 12 }
const SESSIONS: Record<number, TickSession> = { 0: 'pre', 1: 'regular', 2: 'post' }

const readFields = (bytes: Uint8Array): Map<number, FieldValue> | null => {
  const fields = new Map<number, FieldValue>()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 0

  const varint = (): bigint | null => {
    let value = 0n
    for (let index = 0; index < MAX_VARINT_BYTES && at < bytes.length; index += 1) {
      const byte = bytes[at]
      at += 1
      value |= BigInt(byte & 0x7f) << BigInt(7 * index)
      if ((byte & 0x80) === 0) return value
    }
    return null
  }

  const skip = (length: number): boolean => {
    if (at + length > bytes.length) return false
    at += length
    return true
  }

  const readValue = (wire: number): FieldValue | null | undefined => {
    if (wire === VARINT) return varint()
    if (wire === FIXED_64) return skip(8) ? undefined : null
    if (wire === FIXED_32) return skip(4) ? view.getFloat32(at - 4, true) : null
    if (wire !== BYTES) return null
    const length = varint()
    if (length === null || !skip(Number(length))) return null
    return bytes.subarray(at - Number(length), at)
  }

  while (at < bytes.length) {
    const key = varint()
    if (key === null) return null
    const value = readValue(Number(key & 7n))
    if (value === null) return null
    if (value !== undefined) fields.set(Number(key >> 3n), value)
  }
  return fields
}

const unsigned = (value: FieldValue | undefined): number | null => (typeof value === 'bigint' ? Number(value) : null)

const signed = (value: FieldValue | undefined): number | null =>
  typeof value === 'bigint' ? Number((value >> 1n) ^ -(value & 1n)) : null

const decimal = (value: FieldValue | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Number(value.toPrecision(SIGNIFICANT_DIGITS)) : null

const symbolOf = (value: FieldValue | undefined): string | null => {
  if (!(value instanceof Uint8Array)) return null
  const symbol = new TextDecoder().decode(value)
  return SYMBOL_PATTERN.test(symbol) ? symbol.toUpperCase() : null
}

const positive = (value: number | null): number | null => (value !== null && value > 0 && Number.isFinite(value) ? value : null)

export const decodeTick = (base64: string): LiveTick | null => {
  const bytes = Buffer.from(base64, 'base64')
  const fields = bytes.length <= MAX_BYTES ? readFields(bytes) : null
  if (!fields) return null
  const symbol = symbolOf(fields.get(FIELD.symbol))
  const price = positive(decimal(fields.get(FIELD.price)))
  const time = positive(signed(fields.get(FIELD.time)))
  const session = SESSIONS[unsigned(fields.get(FIELD.marketHours)) ?? 0]
  if (!symbol || price === null || time === null || !session) return null
  return {
    symbol,
    price,
    change: decimal(fields.get(FIELD.change)) ?? 0,
    changePercent: decimal(fields.get(FIELD.changePercent)) ?? 0,
    time,
    session,
    volume: positive(signed(fields.get(FIELD.volume))),
  }
}
