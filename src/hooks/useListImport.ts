import { useState } from 'react'
import { symbolsOf } from '../../shared/listItems'
import type { ListItem, SymbolInfo } from '../../shared/types'
import { resolveSymbols } from '../api/client'
import { findSymbols, importedItems, listNameFromFile, parseListFile } from '../domain/listFiles'
import { newId } from '../domain/newId'

export type ImportProgress =
  | { status: 'checking'; name: string; done: number; total: number }
  | { status: 'done'; name: string; added: number; notFound: string[] }
  | { status: 'failed'; name: string }

type Resolve = (groups: string[][]) => Promise<(SymbolInfo | null)[]>

export const useListImport = (
  onCreate: (id: string, name: string, items: ListItem[]) => void,
  resolve: Resolve = resolveSymbols,
  makeId: () => string = newId,
) => {
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  const start = async (file: File): Promise<void> => {
    const name = listNameFromFile(file.name)
    const entries = parseListFile(file.name, await file.text().catch(() => ''))
    const total = entries.filter((entry) => entry.kind === 'symbol').length
    setProgress({ status: 'checking', name, done: 0, total })
    try {
      const found = await findSymbols(entries, resolve, (done) => setProgress({ status: 'checking', name, done, total }))
      const { items, notFound } = importedItems(entries, found, makeId)
      const added = symbolsOf(items).length
      if (added > 0) onCreate(makeId(), name, items)
      setProgress({ status: 'done', name, added, notFound })
    } catch {
      setProgress({ status: 'failed', name })
    }
  }

  return { progress, start, close: () => setProgress(null) }
}
