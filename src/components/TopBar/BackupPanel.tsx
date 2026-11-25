import { type FormEvent, useEffect, useState } from 'react'
import { type BackupApi, type BackupStatus, backupApi, isApiError } from '../../api/client'
import * as Styles from './styles'

type BackupPanelProps = { api?: BackupApi }

type Note = { text: string; problem: boolean } | null

const problemOf = (error: unknown): string =>
  isApiError(error) && error.code === 'invalid_key' ? 'That does not look like a Twelve Data key.' : 'Could not save the key. Try again.'

export const BackupPanel = ({ api = backupApi }: BackupPanelProps) => {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [key, setKey] = useState('')
  const [note, setNote] = useState<Note>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    api
      .status()
      .then((loaded) => {
        if (active) setStatus(loaded)
      })
      .catch(() => {
        if (active) setStatus({ configured: false, source: 'Twelve Data' })
      })
    return () => {
      active = false
    }
  }, [api])

  const run = async (work: () => Promise<BackupStatus>) => {
    setBusy(true)
    setNote(null)
    try {
      setStatus(await work())
      setKey('')
    } catch (error) {
      setNote({ text: problemOf(error), problem: true })
    } finally {
      setBusy(false)
    }
  }

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    run(() => api.save(key))
  }

  if (!status) return null

  return (
    <>
      <Styles.MenuSection>Backup data</Styles.MenuSection>
      {status.configured ? (
        <>
          <Styles.MenuNote>Twelve Data steps in when Yahoo fails three times in a row.</Styles.MenuNote>
          <Styles.ConfirmActions>
            <Styles.TextButton type="button" $danger disabled={busy} onClick={() => run(() => api.remove())}>
              Remove key
            </Styles.TextButton>
          </Styles.ConfirmActions>
        </>
      ) : (
        <Styles.TelegramForm onSubmit={handleSave}>
          <Styles.MenuNote>If Yahoo stops answering, doji can take daily prices of US stocks, crypto and forex from Twelve Data. Paste a free key from twelvedata.com.</Styles.MenuNote>
          <Styles.TokenInput
            type="password"
            aria-label="Twelve Data key"
            placeholder="Twelve Data key"
            autoComplete="off"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          <Styles.TextButton type="submit" disabled={busy || key.trim() === ''}>
            Save key
          </Styles.TextButton>
        </Styles.TelegramForm>
      )}
      {note && (
        <Styles.MenuNote role={note.problem ? 'alert' : 'status'} $danger={note.problem}>
          {note.text}
        </Styles.MenuNote>
      )}
    </>
  )
}
