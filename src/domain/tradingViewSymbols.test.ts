import { describe, expect, test } from 'vitest'
import { tradingViewSymbol, yahooCandidates } from './tradingViewSymbols'

describe('yahooCandidates', () => {
  test('Should drop the exchange of a United States share', () => {
    expect(yahooCandidates('NASDAQ:AAPL')).toEqual(['AAPL'])
    expect(yahooCandidates('NYSE:KO')).toEqual(['KO'])
    expect(yahooCandidates('AMEX:SPY')).toEqual(['SPY'])
  })

  test('Should write share classes with a hyphen, as Yahoo does', () => {
    expect(yahooCandidates('NYSE:BRK.B')).toEqual(['BRK-B'])
    expect(yahooCandidates('TSX:RCI.B')).toEqual(['RCI-B.TO'])
  })

  test('Should add the Yahoo suffix of each foreign exchange', () => {
    expect(yahooCandidates('BME:SAN')).toEqual(['SAN.MC'])
    expect(yahooCandidates('XETR:SAP')).toEqual(['SAP.DE'])
    expect(yahooCandidates('LSE:RR.')).toEqual(['RR.L'])
    expect(yahooCandidates('MIL:ENI')).toEqual(['ENI.MI'])
    expect(yahooCandidates('TSE:7203')).toEqual(['7203.T'])
  })

  test('Should pad Hong Kong codes to four digits', () => {
    expect(yahooCandidates('HKEX:700')).toEqual(['0700.HK'])
  })

  test('Should try every Euronext market in turn', () => {
    expect(yahooCandidates('EURONEXT:MC')).toEqual(['MC.PA', 'MC.AS', 'MC.BR', 'MC.LS', 'MC.IR'])
  })

  test('Should turn currency pairs, crypto pairs and continuous futures into their Yahoo symbols', () => {
    expect(yahooCandidates('FX:EURUSD')).toEqual(['EURUSD=X'])
    expect(yahooCandidates('OANDA:USDJPY')).toEqual(['USDJPY=X'])
    expect(yahooCandidates('BINANCE:BTCUSDT')).toEqual(['BTC-USD'])
    expect(yahooCandidates('COINBASE:ETHEUR')).toEqual(['ETH-EUR'])
    expect(yahooCandidates('CME_MINI:ES1!')).toEqual(['ES=F'])
    expect(yahooCandidates('COMEX:GC1!')).toEqual(['GC=F'])
  })

  test('Should know the usual indices and commodities by name', () => {
    expect(yahooCandidates('SP:SPX')).toEqual(['^GSPC'])
    expect(yahooCandidates('TVC:VIX')).toEqual(['^VIX'])
    expect(yahooCandidates('NASDAQ:NDX')).toEqual(['^NDX'])
    expect(yahooCandidates('TVC:DXY')).toEqual(['DX-Y.NYB'])
    expect(yahooCandidates('TVC:GOLD')).toEqual(['GC=F'])
    expect(yahooCandidates('BME:IBC')).toEqual(['^IBEX'])
  })

  test('Should take a plain ticker as it is and guess an unknown exchange as American', () => {
    expect(yahooCandidates('aapl')).toEqual(['AAPL'])
    expect(yahooCandidates('SAN.MC')).toEqual(['SAN.MC'])
    expect(yahooCandidates('MARS:XYZ')).toEqual(['XYZ'])
  })

  test('Should give nothing for text that cannot be a symbol', () => {
    expect(yahooCandidates('')).toEqual([])
    expect(yahooCandidates('NASDAQ:')).toEqual([])
    expect(yahooCandidates('not a symbol')).toEqual([])
  })
})

describe('tradingViewSymbol', () => {
  test('Should name a United States share by its exchange', () => {
    expect(tradingViewSymbol({ symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ' })).toBe('NASDAQ:AAPL')
    expect(tradingViewSymbol({ symbol: 'KO', name: 'Coca-Cola', exchange: 'NYSE' })).toBe('NYSE:KO')
    expect(tradingViewSymbol({ symbol: 'SPY', name: 'SPDR', exchange: 'NYSE Arca' })).toBe('AMEX:SPY')
    expect(tradingViewSymbol({ symbol: 'BRK-B', name: 'Berkshire', exchange: 'NYSE' })).toBe('NYSE:BRK.B')
  })

  test('Should name a foreign share by the exchange of its suffix', () => {
    expect(tradingViewSymbol({ symbol: 'SAN.MC', name: 'Santander', exchange: 'MCE' })).toBe('BME:SAN')
    expect(tradingViewSymbol({ symbol: 'MC.PA', name: 'LVMH', exchange: 'Paris' })).toBe('EURONEXT:MC')
    expect(tradingViewSymbol({ symbol: '0700.HK', name: 'Tencent', exchange: 'HKSE' })).toBe('HKEX:700')
  })

  test('Should name pairs, futures and indices the way TradingView does', () => {
    expect(tradingViewSymbol({ symbol: 'EURUSD=X', name: 'EUR/USD', exchange: 'Forex' })).toBe('FX:EURUSD')
    expect(tradingViewSymbol({ symbol: 'BTC-USD', name: 'Bitcoin', exchange: 'Crypto' })).toBe('COINBASE:BTCUSD')
    expect(tradingViewSymbol({ symbol: 'ES=F', name: 'E-Mini', exchange: 'CME' })).toBe('ES1!')
    expect(tradingViewSymbol({ symbol: '^GSPC', name: 'S&P 500', exchange: 'SNP' })).toBe('SP:SPX')
  })

  test('Should leave an unknown symbol bare so TradingView can look it up', () => {
    expect(tradingViewSymbol({ symbol: 'XYZ', name: 'XYZ', exchange: 'Somewhere' })).toBe('XYZ')
    expect(tradingViewSymbol({ symbol: '^XYZ', name: 'XYZ', exchange: 'Somewhere' })).toBe('XYZ')
  })
})

test('Should turn the share class of the Nordic markets between the TradingView underscore and the Yahoo hyphen', () => {
  expect(yahooCandidates('OMXSTO:VOLV_B')).toEqual(['VOLV-B.ST'])
  expect(yahooCandidates('OMXCOP:NOVO_B')).toEqual(['NOVO-B.CO'])
  expect(tradingViewSymbol({ symbol: 'VOLV-B.ST', name: 'Volvo', exchange: 'Stockholm' })).toBe('OMXSTO:VOLV_B')
  expect(tradingViewSymbol({ symbol: 'NOVO-B.CO', name: 'Novo Nordisk', exchange: 'Copenhagen' })).toBe('OMXCOP:NOVO_B')
  expect(tradingViewSymbol({ symbol: 'BRK-B', name: 'Berkshire', exchange: 'NYSE' })).toBe('NYSE:BRK.B')
})

test('Should read a continuous future written without its exchange, as it is exported', () => {
  expect(yahooCandidates('ES1!')).toEqual(['ES=F'])
  expect(yahooCandidates(tradingViewSymbol({ symbol: 'CL=F', name: 'Crude Oil', exchange: 'NY Mercantile' }))).toEqual(['CL=F'])
  expect(yahooCandidates('AAPL')).toEqual(['AAPL'])
})
