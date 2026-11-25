import { LIST_NAME_MAX_LENGTH } from '../../shared/limits'
import { isSection } from '../../shared/listItems'
import type { ListItem, SymbolInfo, SymbolList } from '../../shared/types'
import { tradingViewSymbol, yahooCandidates } from './tradingViewSymbols'

export type ImportEntry = { kind: 'symbol'; text: string; candidates: string[] } | { kind: 'section'; title: string }

export type ListFormat = 'csv' | 'tradingview'

const SECTION_MARK = '###'
const DEFAULT_IMPORT_NAME = 'Imported list'
const DEFAULT_EXPORT_NAME = 'watchlist'
const CSV_HEADER = ['Symbol', 'Name', 'Exchange', 'Section']
const SYMBOL_HEADERS = ['symbol', 'ticker', 'símbolo', 'simbolo']
const SECTION_HEADERS = ['section', 'sección', 'seccion']
const EXTENSIONS: Record<ListFormat, string> = { csv: 'csv', tradingview: 'txt' }
const TYPES: Record<ListFormat, string> = { csv: 'text/csv', tradingview: 'text/plain' }

const symbolEntry = (text: string): ImportEntry => ({ kind: 'symbol', text, candidates: yahooCandidates(text) })

const sectionTitle = (text: string): string => text.trim().slice(0, LIST_NAME_MAX_LENGTH)

const parseTradingViewList = (text: string): ImportEntry[] =>
  text
    .split(/[,\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.startsWith(SECTION_MARK) ? { kind: 'section', title: sectionTitle(entry.slice(SECTION_MARK.length)) || 'Section' } : symbolEntry(entry)))

const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_MARK = "'"

const delimiterOf = (text: string): string => {
  const counts = { ';': 0, ',': 0 }
  let quoted = false
  for (const char of text) {
    if (char === '"') quoted = !quoted
    else if (!quoted && (char === '\n' || char === '\r')) break
    else if (!quoted && (char === ';' || char === ',')) counts[char] += 1
  }
  return counts[';'] > counts[','] ? ';' : ','
}

const unmarked = (value: string): string => (value.startsWith(PLAIN_MARK) && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value)

const csvRows = (text: string): string[][] => {
  const delimiter = delimiterOf(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted && char === '"' && text[index + 1] === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (!quoted && char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      rows.push([...row, cell])
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  rows.push([...row, cell])
  return rows.map((cells) => cells.map((value) => unmarked(value.trim()))).filter((cells) => cells.some(Boolean))
}

const columnsOf = (rows: string[][]): { header: boolean; symbol: number; section: number } => {
  const first = rows[0]?.map((cell) => cell.toLowerCase()) ?? []
  const symbol = first.findIndex((cell) => SYMBOL_HEADERS.includes(cell))
  if (symbol >= 0) return { header: true, symbol, section: first.findIndex((cell) => SECTION_HEADERS.includes(cell)) }
  return { header: false, symbol: 0, section: rows.every((cells) => cells.length === 2) ? 1 : -1 }
}

const parseCsvList = (text: string): ImportEntry[] => {
  const rows = csvRows(text)
  const columns = columnsOf(rows)
  const loose: ImportEntry[] = []
  const grouped: ImportEntry[] = []
  let current = ''
  for (const cells of columns.header ? rows.slice(1) : rows) {
    const symbol = cells[columns.symbol] ?? ''
    const section = columns.section >= 0 ? sectionTitle(cells[columns.section] ?? '') : ''
    if (!symbol) continue
    if (!section) {
      loose.push(symbolEntry(symbol))
      continue
    }
    if (section !== current) grouped.push({ kind: 'section', title: section })
    current = section
    grouped.push(symbolEntry(symbol))
  }
  return [...loose, ...grouped]
}

export const parseListFile = (fileName: string, text: string): ImportEntry[] =>
  fileName.toLowerCase().endsWith('.csv') ? parseCsvList(text) : parseTradingViewList(text)

const CHECK_BATCH = 25

export const findSymbols = async (
  entries: ImportEntry[],
  resolve: (groups: string[][]) => Promise<(SymbolInfo | null)[]>,
  onProgress: (done: number) => void,
): Promise<(SymbolInfo | null)[]> => {
  const symbols = entries.flatMap((entry) => (entry.kind === 'symbol' ? [entry] : []))
  const found: (SymbolInfo | null)[] = symbols.map(() => null)
  const wanted = symbols.flatMap((entry, index) => (entry.candidates.length > 0 ? [{ index, candidates: entry.candidates }] : []))
  const skipped = symbols.length - wanted.length
  for (let start = 0; start < wanted.length; start += CHECK_BATCH) {
    const batch = wanted.slice(start, start + CHECK_BATCH)
    const answer = await resolve(batch.map((item) => item.candidates))
    batch.forEach((item, position) => {
      found[item.index] = answer[position] ?? null
    })
    onProgress(skipped + start + batch.length)
  }
  return found
}

export const importedItems = (
  entries: ImportEntry[],
  found: (SymbolInfo | null)[],
  makeId: () => string,
): { items: ListItem[]; notFound: string[] } => {
  const items: ListItem[] = []
  const notFound: string[] = []
  const seen = new Set<string>()
  let symbolIndex = 0
  for (const entry of entries) {
    if (entry.kind === 'section') {
      items.push({ kind: 'section', id: makeId(), title: entry.title })
      continue
    }
    const info = found[symbolIndex] ?? null
    symbolIndex += 1
    if (!info) notFound.push(entry.text)
    if (!info || seen.has(info.symbol)) continue
    seen.add(info.symbol)
    items.push(info)
  }
  return { items, notFound }
}

const plainText = (value: string): string => (FORMULA_START.test(value) ? `${PLAIN_MARK}${value}` : value)

const quoted = (value: string): string => (/[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

const csvCell = (value: string): string => quoted(plainText(value))

const withSections = (items: ListItem[]): [SymbolInfo, string][] => {
  let section = ''
  return items.flatMap((item): [SymbolInfo, string][] => {
    if (!isSection(item)) return [[item, section]]
    section = item.title
    return []
  })
}

export const listToCsv = (list: SymbolList): string =>
  [CSV_HEADER, ...withSections(list.items).map(([info, section]) => [info.symbol, info.name, info.exchange, section])]
    .map((cells) => cells.map(csvCell).join(','))
    .join('\n')
    .concat('\n')

export const listToTradingView = (list: SymbolList): string =>
  list.items
    .map((item) => (isSection(item) ? `${SECTION_MARK}${item.title.replace(/\s*[,\r\n]+\s*/g, ' ')}` : tradingViewSymbol(item)))
    .join(',')

export const listNameFromFile = (fileName: string): string =>
  fileName.replace(/\.[^.]*$/, '').trim().slice(0, LIST_NAME_MAX_LENGTH) || DEFAULT_IMPORT_NAME

export const exportFileName = (list: SymbolList, format: ListFormat): string => {
  const safe = list.name.replace(/[/\\:*?"<>|]/g, '-').trim()
  return `${/[\p{L}\p{N}]/u.test(safe) ? safe : DEFAULT_EXPORT_NAME}.${EXTENSIONS[format]}`
}

export const listFile = (list: SymbolList, format: ListFormat): { text: string; name: string; type: string } => ({
  text: format === 'csv' ? listToCsv(list) : listToTradingView(list),
  name: exportFileName(list, format),
  type: TYPES[format],
})
