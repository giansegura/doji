import { expect, test } from 'vitest'
import { decodeTick } from './pricing'

const AAPL = 'CgRBQVBMFYWbsEMYsKqF4cFoKgNOTVMwCDgBRYGdlz9IiIfKBWUAUoRAsAFQ2AEE9QIAUoRA/QKBnZc/'
const EURUSD = 'CghFVVJVU0Q9WBVHd4w/GLCqheHBaCoDQ0NZMA44AUVJQSo/ZQCS7TvYAQj1AgCS7Tv9AklBKj8='
const BTC =
  'CgdCVEMtVVNEFSGca0cYsKqF4cFoIgNVU0QqA0NDQzApOAFFw1h/wEiAwJ2pkgJVqj5wR137aGhHZeCnHMV9JhtvR7ABgMCdqZIC2AEE4AGAwJ2pkgLoAYDAnamSAvIBA0JUQ4ECAAAAQFIvc0GJAgAAA8GroXFC9QLgpxzF/QLDWH/A'
const SANTANDER = 'CgZTQU4uTUMV/tQoQRjwu5fgwWgqA01DRTAIOAFFzA1VvkjQitEFZQA6tLywATbYAQT1AgA6tLz9AswNVb4='

const varint = (value: bigint): number[] => {
  const out: number[] = []
  let rest = value
  while (rest > 0x7fn) {
    out.push(Number(rest & 0x7fn) | 0x80)
    rest >>= 7n
  }
  return [...out, Number(rest)]
}

const text = (field: number, value: string): number[] => {
  const bytes = [...new TextEncoder().encode(value)]
  return [(field << 3) | 2, ...varint(BigInt(bytes.length)), ...bytes]
}

const float = (field: number, value: number): number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setFloat32(0, value, true)
  return [...varint(BigInt((field << 3) | 5)), ...bytes]
}

const signed = (field: number, value: number): number[] => [...varint(BigInt(field << 3)), ...varint(BigInt(value) * 2n)]

const plain = (field: number, value: number): number[] => [...varint(BigInt(field << 3)), ...varint(BigInt(value))]

const message = (...fields: number[][]): string => Buffer.from(fields.flat()).toString('base64')

const base = [text(1, 'KO'), float(2, 60.25), signed(3, 1795532303000)]

test('Should read a real tick of a stock with its price, time, change and volume of the day', () => {
  expect(decodeTick(AAPL)).toEqual({
    symbol: 'AAPL',
    price: 353.215,
    change: 4.13501,
    changePercent: 1.184494,
    time: 1795532303000,
    session: 'regular',
    volume: 5849540,
  })
})

test('Should read a real tick of a currency pair, which has no volume', () => {
  expect(decodeTick(EURUSD)).toEqual({
    symbol: 'EURUSD=X',
    price: 1.09739,
    change: 0.007250071,
    changePercent: 0.6650587,
    time: 1795532303000,
    session: 'regular',
    volume: null,
  })
})

test('Should read a real tick with fields it does not use', () => {
  expect(decodeTick(BTC)).toMatchObject({ symbol: 'BTC-USD', price: 60316.13, time: 1795532303000, volume: 36818890752 })
  expect(decodeTick(SANTANDER)).toMatchObject({ symbol: 'SAN.MC', price: 10.552, time: 1795531403000, volume: 5907112 })
})

test('Should tell the session of a tick from its market hours', () => {
  expect(decodeTick(message(...base, plain(7, 1)))?.session).toBe('regular')
  expect(decodeTick(message(...base, plain(7, 2)))?.session).toBe('post')
  expect(decodeTick(message(...base))?.session).toBe('pre')
})

test('Should ignore a tick from market hours it does not know', () => {
  expect(decodeTick(message(...base, plain(7, 3)))).toBeNull()
})

test('Should give no change when the tick carries none', () => {
  expect(decodeTick(message(...base, plain(7, 1)))).toEqual({
    symbol: 'KO',
    price: 60.25,
    change: 0,
    changePercent: 0,
    time: 1795532303000,
    session: 'regular',
    volume: null,
  })
})

test('Should ignore a tick without a symbol, a price or a time', () => {
  expect(decodeTick(message(float(2, 60.25), signed(3, 1795532303000)))).toBeNull()
  expect(decodeTick(message(text(1, 'KO'), signed(3, 1795532303000)))).toBeNull()
  expect(decodeTick(message(text(1, 'KO'), float(2, 60.25)))).toBeNull()
  expect(decodeTick(message(text(1, 'KO'), float(2, 0), signed(3, 1795532303000)))).toBeNull()
  expect(decodeTick(message(text(1, 'KO'), float(2, Number.NaN), signed(3, 1795532303000)))).toBeNull()
})

test('Should ignore a tick whose symbol could not be a ticker', () => {
  expect(decodeTick(message(text(1, '<script>'), float(2, 60.25), signed(3, 1795532303000)))).toBeNull()
})

test('Should ignore a message that is cut short or is not a pricing message', () => {
  const whole = Buffer.from(AAPL, 'base64')
  expect(decodeTick(whole.subarray(0, 9).toString('base64'))).toBeNull()
  expect(decodeTick(whole.subarray(0, whole.length - 2).toString('base64'))).toBeNull()
  expect(decodeTick('')).toBeNull()
  expect(decodeTick('no es base64 ni un mensaje')).toBeNull()
  expect(decodeTick(Buffer.from([0x0b, 0x01]).toString('base64'))).toBeNull()
  expect(decodeTick(Buffer.from([0x08, ...Array.from({ length: 12 }, () => 0xff)]).toString('base64'))).toBeNull()
})

test('Should ignore a message that is too long to be a tick', () => {
  expect(decodeTick(message(...base, text(13, 'x'.repeat(5000))))).toBeNull()
})
