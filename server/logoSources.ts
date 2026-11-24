import type { Logo, LogoSource } from './logoStore'

const FINNHUB_HOST = 'static2.finnhub.io'
const FINNHUB_LOGOS = `https://${FINNHUB_HOST}/file/publicdatany/finnhubimage/stock_logo`
const FINNHUB_MIN_SIZE = 500
const NOT_A_STOCK = /[\^=]/
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_HEADER_BYTES = 24
const PNG_WIDTH_AT = 16
const PNG_HEIGHT_AT = 20

export const LOGO_SOURCES_VERSION = 'finnhub-yahoo-fmp'

export const finnhubLogoUrl: LogoSource = async (symbol) =>
  NOT_A_STOCK.test(symbol) ? null : `${FINNHUB_LOGOS}/${encodeURIComponent(symbol.replace('-', '.'))}.png`

export const fallbackLogoUrl: LogoSource = async (symbol) =>
  `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`

const pngSize = ({ bytes, contentType }: Logo): { width: number; height: number } | null => {
  const isPng = contentType === 'image/png' && bytes.length >= PNG_HEADER_BYTES && bytes.subarray(0, 8).equals(PNG_SIGNATURE)
  return isPng ? { width: bytes.readUInt32BE(PNG_WIDTH_AT), height: bytes.readUInt32BE(PNG_HEIGHT_AT) } : null
}

const isFromFinnhub = (url: string): boolean => {
  try {
    return new URL(url).hostname === FINNHUB_HOST
  } catch {
    return false
  }
}

export const isUsableLogo = (url: string, logo: Logo): boolean => {
  if (!isFromFinnhub(url)) return true
  const size = pngSize(logo)
  return size !== null && size.width >= FINNHUB_MIN_SIZE && size.height >= FINNHUB_MIN_SIZE
}
