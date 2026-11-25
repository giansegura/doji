import { describe, expect, test } from 'vitest'
import type { SymbolList } from '../../shared/types'
import { exportFileName, findSymbols, importedItems, listFile, listNameFromFile, listToCsv, listToTradingView, parseListFile } from './listFiles'

const list: SymbolList = {
  id: 'l',
  name: 'Tech / "Big"',
  items: [
    { kind: 'section', id: 's1', title: 'US, large' },
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc. "B"', exchange: 'NYSE' },
    { kind: 'section', id: 's2', title: 'Spain' },
    { symbol: 'SAN.MC', name: 'Banco Santander, S.A.', exchange: 'MCE' },
  ],
}

describe('parseListFile', () => {
  test('Should read a TradingView export with its sections and exchanges', () => {
    expect(parseListFile('tech.txt', '###US large,NASDAQ:AAPL,NYSE:BRK.B,###Spain,BME:SAN')).toEqual([
      { kind: 'section', title: 'US large' },
      { kind: 'symbol', text: 'NASDAQ:AAPL', candidates: ['AAPL'] },
      { kind: 'symbol', text: 'NYSE:BRK.B', candidates: ['BRK-B'] },
      { kind: 'section', title: 'Spain' },
      { kind: 'symbol', text: 'BME:SAN', candidates: ['SAN.MC'] },
    ])
  })

  test('Should also read one symbol per line', () => {
    expect(parseListFile('list.txt', 'AAPL\r\n\r\nMSFT\n').map((entry) => (entry.kind === 'symbol' ? entry.text : entry.title))).toEqual(['AAPL', 'MSFT'])
  })

  test('Should read a CSV with a header, taking the symbol and section columns wherever they are', () => {
    const text = 'Name,Symbol,Section\nApple,AAPL,Tech\nMicrosoft,MSFT,Tech\nCoca-Cola,KO,\nRepsol,"BME:REP","Spain"\n'
    expect(parseListFile('mine.CSV', text)).toEqual([
      { kind: 'symbol', text: 'KO', candidates: ['KO'] },
      { kind: 'section', title: 'Tech' },
      { kind: 'symbol', text: 'AAPL', candidates: ['AAPL'] },
      { kind: 'symbol', text: 'MSFT', candidates: ['MSFT'] },
      { kind: 'section', title: 'Spain' },
      { kind: 'symbol', text: 'BME:REP', candidates: ['REP.MC'] },
    ])
  })

  test('Should read a CSV without a header as symbols and an optional section', () => {
    expect(parseListFile('a.csv', 'AAPL;Tech\nKO;Food\n').map((entry) => (entry.kind === 'symbol' ? entry.text : `#${entry.title}`))).toEqual([
      '#Tech',
      'AAPL',
      '#Food',
      'KO',
    ])
    expect(parseListFile('a.csv', 'AAPL\nKO\n').map((entry) => (entry.kind === 'symbol' ? entry.text : entry.title))).toEqual(['AAPL', 'KO'])
  })

  test('Should read quoted cells with commas and doubled quotes', () => {
    const [entry] = parseListFile('a.csv', 'Symbol,Name\n"AAPL","Apple, ""Inc."""\n')
    expect(entry).toEqual({ kind: 'symbol', text: 'AAPL', candidates: ['AAPL'] })
  })

  test('Should keep text that is not a symbol so it can be reported as not found', () => {
    expect(parseListFile('a.txt', 'AAPL,not a symbol')).toEqual([
      { kind: 'symbol', text: 'AAPL', candidates: ['AAPL'] },
      { kind: 'symbol', text: 'not a symbol', candidates: [] },
    ])
  })
})

describe('importedItems', () => {
  test('Should keep the sections and the symbols found, once each, and list the rest as not found', () => {
    const entries = parseListFile('a.txt', '###Tech,NASDAQ:AAPL,ZZZZ,AAPL,###Empty,,')
    const apple = { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' }
    let next = 0
    const result = importedItems(entries, [apple, null, apple], () => `id-${(next += 1)}`)
    expect(result.items).toEqual([{ kind: 'section', id: 'id-1', title: 'Tech' }, apple, { kind: 'section', id: 'id-2', title: 'Empty' }])
    expect(result.notFound).toEqual(['ZZZZ'])
  })
})

describe('findSymbols', () => {
  test('Should check the symbols in batches, skip text that cannot be a symbol and report the progress', async () => {
    const entries = parseListFile('a.txt', ['###S', 'not a symbol', ...Array.from({ length: 30 }, (_, index) => `S${index}`)].join(','))
    const asked: string[][][] = []
    const progress: number[] = []
    const resolve = async (groups: string[][]) => {
      asked.push(groups)
      return groups.map(([symbol]) => (symbol === 'S3' ? null : { symbol, name: symbol, exchange: 'NYSE' }))
    }
    const found = await findSymbols(entries, resolve, (done) => progress.push(done))
    expect(found).toHaveLength(31)
    expect(found[0]).toBeNull()
    expect(found[1]?.symbol).toBe('S0')
    expect(found[4]).toBeNull()
    expect(asked.map((groups) => groups.length)).toEqual([25, 5])
    expect(progress).toEqual([26, 31])
  })
})

describe('listToCsv', () => {
  test('Should write symbol, name, exchange and section, quoting what needs it', () => {
    expect(listToCsv(list)).toBe(
      [
        'Symbol,Name,Exchange,Section',
        'AAPL,Apple Inc.,NASDAQ,"US, large"',
        'BRK-B,"Berkshire Hathaway Inc. ""B""",NYSE,"US, large"',
        'SAN.MC,"Banco Santander, S.A.",MCE,Spain',
        '',
      ].join('\n'),
    )
  })

  test('Should read back what it writes', () => {
    const entries = parseListFile('back.csv', listToCsv(list))
    expect(entries.map((entry) => (entry.kind === 'symbol' ? entry.text : `#${entry.title}`))).toEqual(['#US, large', 'AAPL', 'BRK-B', '#Spain', 'SAN.MC'])
  })
})

describe('listToTradingView', () => {
  test('Should write the TradingView format, with sections and exchanges', () => {
    expect(listToTradingView(list)).toBe('###US large,NASDAQ:AAPL,NYSE:BRK.B,###Spain,BME:SAN')
  })
})

describe('file names', () => {
  test('Should name the import after the file and the export after the list', () => {
    expect(listNameFromFile('Dividendos 2026.txt')).toBe('Dividendos 2026')
    expect(listNameFromFile('.csv')).toBe('Imported list')
    expect(listNameFromFile(`${'x'.repeat(60)}.csv`)).toHaveLength(40)
    expect(exportFileName(list, 'csv')).toBe('Tech - -Big-.csv')
    expect(exportFileName({ ...list, name: '///' }, 'tradingview')).toBe('watchlist.txt')
  })
})

describe('listFile', () => {
  test('Should give the text, name and type of each export', () => {
    expect(listFile(list, 'csv')).toEqual({ text: listToCsv(list), name: 'Tech - -Big-.csv', type: 'text/csv' })
    expect(listFile(list, 'tradingview')).toEqual({ text: listToTradingView(list), name: 'Tech - -Big-.txt', type: 'text/plain' })
  })
})

describe('edge cases', () => {
  const texts = (entries: ReturnType<typeof parseListFile>) => entries.map((entry) => (entry.kind === 'symbol' ? entry.text : `#${entry.title}`))

  test('Should pick the separator of a CSV without counting the ones inside quotes', () => {
    expect(texts(parseListFile('l.csv', 'AAPL,"Tech; growth; income"\nKO,Staples\n'))).toEqual(['#Tech; growth; income', 'AAPL', '#Staples', 'KO'])
    expect(texts(parseListFile('l.csv', 'AAPL;"Tech, US"\nKO;Staples\n'))).toEqual(['#Tech, US', 'AAPL', '#Staples', 'KO'])
  })

  test('Should keep the symbols without a section out of the section before them', () => {
    expect(texts(parseListFile('l.csv', 'Symbol,Section\nAAPL,Tech\nKO,\nMSFT,Tech\n'))).toEqual(['KO', '#Tech', 'AAPL', 'MSFT'])
  })

  test('Should write text that a spreadsheet would run as a formula as plain text, and read it back the same', () => {
    const risky: SymbolList = { id: 'r', name: 'r', items: [{ kind: 'section', id: 's', title: '=1+1' }, { symbol: 'AAPL', name: '@Apple', exchange: 'NASDAQ' }] }
    const csv = listToCsv(risky)
    expect(csv).toBe("Symbol,Name,Exchange,Section\nAAPL,'@Apple,NASDAQ,'=1+1\n")
    expect(texts(parseListFile('r.csv', csv))).toEqual(['#=1+1', 'AAPL'])
  })

  test('Should keep line breaks out of the section titles written for TradingView', () => {
    const broken: SymbolList = { id: 'b', name: 'b', items: [{ kind: 'section', id: 's', title: 'Long\nMSFT\r\nidea' }, { symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ' }] }
    expect(listToTradingView(broken)).toBe('###Long MSFT idea,NASDAQ:AAPL')
  })
})
