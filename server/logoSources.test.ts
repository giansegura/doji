import { expect, test } from 'vitest'
import { fallbackLogoUrl, finnhubLogoUrl, isUsableLogo } from './logoSources'

const FINNHUB = 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo'

const pngOf = (width: number, height = width): Buffer => {
  const bytes = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

test('Should point at the Finnhub logo of a symbol', async () => {
  expect(await finnhubLogoUrl('AAPL')).toBe(`${FINNHUB}/AAPL.png`)
  expect(await finnhubLogoUrl('SAN.MC')).toBe(`${FINNHUB}/SAN.MC.png`)
})

test('Should write share classes the way Finnhub does', async () => {
  expect(await finnhubLogoUrl('BRK-B')).toBe(`${FINNHUB}/BRK.B.png`)
})

test('Should not ask Finnhub for indices, currencies or futures', async () => {
  expect(await finnhubLogoUrl('^GSPC')).toBeNull()
  expect(await finnhubLogoUrl('EURUSD=X')).toBeNull()
  expect(await finnhubLogoUrl('GC=F')).toBeNull()
})

test('Should point at the fallback logo of a symbol, escaping it', async () => {
  expect(await fallbackLogoUrl('BRK-B')).toBe('https://financialmodelingprep.com/image-stock/BRK-B.png')
  expect(await fallbackLogoUrl('^GSPC')).toBe('https://financialmodelingprep.com/image-stock/%5EGSPC.png')
})

test('Should take from Finnhub only its large tiles', () => {
  const url = `${FINNHUB}/AAPL.png`
  expect(isUsableLogo(url, { bytes: pngOf(1000), contentType: 'image/png' })).toBe(true)
  expect(isUsableLogo(url, { bytes: pngOf(500), contentType: 'image/png' })).toBe(true)
  expect(isUsableLogo(url, { bytes: pngOf(194), contentType: 'image/png' })).toBe(false)
  expect(isUsableLogo(url, { bytes: pngOf(1000, 400), contentType: 'image/png' })).toBe(false)
})

test('Should not take from Finnhub what is not a readable PNG', () => {
  const url = `${FINNHUB}/AAPL.png`
  expect(isUsableLogo(url, { bytes: Buffer.from('no es un png'), contentType: 'image/png' })).toBe(false)
  expect(isUsableLogo(url, { bytes: pngOf(1000).subarray(0, 20), contentType: 'image/png' })).toBe(false)
  expect(isUsableLogo(url, { bytes: pngOf(1000), contentType: 'image/jpeg' })).toBe(false)
})

test('Should take any image from the other sources', () => {
  const logo = { bytes: pngOf(150), contentType: 'image/png' }
  expect(isUsableLogo('https://s.yimg.com/lb/brands/150x150_apple.png', logo)).toBe(true)
  expect(isUsableLogo('https://financialmodelingprep.com/image-stock/SPY.png', { bytes: Buffer.from('x'), contentType: 'image/webp' })).toBe(true)
})
