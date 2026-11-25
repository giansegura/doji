import { expect, test } from 'vitest'
import { currencyPair, displaySymbol, priceDigits, tradesEveryDay } from './symbols'

test('Should read the two currencies of a forex pair the way Yahoo writes it', () => {
  expect(currencyPair('EURUSD=X')).toEqual(['EUR', 'USD'])
  expect(currencyPair('gbpjpy=x')).toEqual(['GBP', 'JPY'])
})

test('Should read a single currency as a pair against the US dollar', () => {
  expect(currencyPair('EUR=X')).toEqual(['USD', 'EUR'])
  expect(currencyPair('JPY=X')).toEqual(['USD', 'JPY'])
})

test('Should tell that stocks, indices and futures are not forex pairs', () => {
  expect(['AAPL', 'BRK-B', '^GSPC', 'GC=F', 'EURUSD', 'EURO=X'].map(currencyPair)).toEqual([null, null, null, null, null, null])
})

test('Should show a forex pair like TradingView and leave other symbols alone', () => {
  expect(displaySymbol('EURUSD=X')).toBe('EURUSD')
  expect(displaySymbol('EUR=X')).toBe('USDEUR')
  expect(displaySymbol('BRK-B')).toBe('BRK-B')
})

test('Should give forex four decimals, or three when a pair trades above twenty', () => {
  expect(priceDigits('EURUSD=X', 1.0967)).toBe(4)
  expect(priceDigits('JPY=X', 159.129)).toBe(3)
})

test('Should give other symbols two decimals, or four under one', () => {
  expect(priceDigits('AAPL', 349.08)).toBe(2)
  expect(priceDigits('SIRI', 0.4512)).toBe(4)
  expect(priceDigits('', 0)).toBe(2)
})

test('Should tell the cryptocurrencies that trade every day from stocks with a class letter', () => {
  expect(tradesEveryDay('BTC-USD')).toBe(true)
  expect(tradesEveryDay('ETH-EUR')).toBe(true)
  expect(tradesEveryDay('BTC-CAD')).toBe(true)
  expect(tradesEveryDay('SOL-USDT')).toBe(true)
  expect(tradesEveryDay('BRK-B')).toBe(false)
  expect(tradesEveryDay('BAC-PL')).toBe(false)
  expect(tradesEveryDay('REI-UN.TO')).toBe(false)
  expect(tradesEveryDay('AAPL')).toBe(false)
})

test('Should give more decimals to prices far below one', () => {
  expect(priceDigits('SHIB-USD', 0.000012)).toBe(8)
  expect(priceDigits('DOGE-USD', 0.0042)).toBe(6)
  expect(priceDigits('XRP-USD', 0.52)).toBe(4)
  expect(priceDigits('BTC-USD', 98000)).toBe(2)
})
