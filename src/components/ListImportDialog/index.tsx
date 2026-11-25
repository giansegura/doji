import { useEffect } from 'react'
import type { ImportProgress } from '../../hooks/useListImport'
import * as Styles from './styles'

type ListImportDialogProps = { progress: ImportProgress; onClose: () => void }

const symbolsWord = (count: number): string => (count === 1 ? 'symbol' : 'symbols')

const Summary = ({ progress }: { progress: Extract<ImportProgress, { status: 'done' }> }) => {
  if (progress.added === 0) return <Styles.Text>None of the symbols in the file were found, so no list was made.</Styles.Text>

  return <Styles.Text>{`Imported ${progress.added} ${symbolsWord(progress.added)} into the new list “${progress.name}”.`}</Styles.Text>
}

export const ListImportDialog = ({ progress, onClose }: ListImportDialogProps) => {
  const working = progress.status === 'checking'

  useEffect(() => {
    if (working) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [working, onClose])

  if (progress.status === 'checking') {
    return (
      <Styles.Backdrop>
        <Styles.Dialog role="dialog" aria-modal="true" aria-label="Import list">
          <Styles.Title>{`Importing “${progress.name}”`}</Styles.Title>
          <Styles.Text role="status">{`Checking the symbols with Yahoo… ${progress.done} of ${progress.total}`}</Styles.Text>
          <Styles.Track role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <Styles.Fill $share={progress.total > 0 ? progress.done / progress.total : 0} />
          </Styles.Track>
        </Styles.Dialog>
      </Styles.Backdrop>
    )
  }

  return (
    <Styles.Backdrop>
      <Styles.Dialog role="dialog" aria-modal="true" aria-label="Import list">
        <Styles.Title>{`Importing “${progress.name}”`}</Styles.Title>
        {progress.status === 'failed' && <Styles.Text role="alert">Could not check the symbols with Yahoo. Try again in a moment.</Styles.Text>}
        {progress.status === 'done' && <Summary progress={progress} />}
        {progress.status === 'done' && progress.notFound.length > 0 && (
          <Styles.Missing>
            <Styles.MissingTitle>{`Not found (${progress.notFound.length}):`}</Styles.MissingTitle>
            <Styles.MissingList>{progress.notFound.join(', ')}</Styles.MissingList>
          </Styles.Missing>
        )}
        <Styles.Footer>
          <Styles.Button type="button" autoFocus onClick={onClose}>
            Close
          </Styles.Button>
        </Styles.Footer>
      </Styles.Dialog>
    </Styles.Backdrop>
  )
}
