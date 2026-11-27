import { useEffect, useState } from 'react'
import { type GoogleApi, type GoogleStatus, type GoogleSummary, googleApi } from '../../api/client'
import * as Styles from './styles'

type GooglePanelProps = { api?: GoogleApi; openPage?: (url: string) => void }

const CHECK_MS = 2000

const openInNewTab = (url: string): void => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const dateText = (iso: string): string => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

const counted = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

const summaryLine = (name: string, { lists, symbols, drawings, changedAt }: GoogleSummary): string => {
  const holds = [counted(lists, 'list'), counted(symbols, 'symbol'), counted(drawings, 'drawing')].join(', ')
  return `${name}: ${holds}${changedAt ? ` · ${dateText(changedAt)}` : ''}`
}

const syncLine = ({ sync, lastSyncAt }: GoogleStatus): string => {
  if (sync === 'syncing') return 'Syncing…'
  if (sync === 'offline') return 'Offline. Your changes stay on this computer and doji will try again.'
  if (sync === 'failed') return 'Google Drive is not answering. doji will try again.'
  return lastSyncAt ? `Last synced ${dateText(lastSyncAt)}` : 'Not synced yet'
}

export const GooglePanel = ({ api = googleApi, openPage = openInNewTab }: GooglePanelProps) => {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [problem, setProblem] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const moving = status?.sync === 'waiting' || status?.sync === 'syncing'

  useEffect(() => {
    let active = true
    api
      .status()
      .then((loaded) => {
        if (active) setStatus(loaded)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [api])

  useEffect(() => {
    if (!moving) return
    let active = true
    const check = setInterval(() => {
      api
        .status()
        .then((loaded) => {
          if (active) setStatus(loaded)
        })
        .catch(() => undefined)
    }, CHECK_MS)
    return () => {
      active = false
      clearInterval(check)
    }
  }, [api, moving])

  const run = async (work: () => Promise<GoogleStatus>) => {
    setBusy(true)
    setProblem(false)
    try {
      setStatus(await work())
    } catch {
      setProblem(true)
    } finally {
      setBusy(false)
    }
  }

  const signIn = () =>
    run(async () => {
      const { url } = await api.signIn()
      openPage(url)
      return api.status()
    })

  const syncNow = async () => {
    setSyncing(true)
    await run(() => api.syncNow())
    setSyncing(false)
  }

  if (!status?.configured) return null

  const cannotSync = busy || status.sync === 'syncing'
  const signInButton = (label: string) => (
    // Not `disabled` here either: "Start again" stays on screen after it is pressed.
    <Styles.TextButton type="button" aria-disabled={busy} onClick={() => !busy && signIn()}>
      {label}
    </Styles.TextButton>
  )
  const signOutButton = (
    <Styles.TextButton type="button" $danger disabled={busy} onClick={() => run(() => api.signOut())}>
      Sign out
    </Styles.TextButton>
  )

  return (
    <>
      <Styles.MenuSection>Google Drive</Styles.MenuSection>
      {status.sync === 'signedOut' && (
        <>
          <Styles.MenuNote>Keep your settings in your own Google Drive and use them on any computer. doji only sees the files it creates.</Styles.MenuNote>
          <Styles.ConfirmActions>{signInButton('Sign in with Google')}</Styles.ConfirmActions>
        </>
      )}
      {status.sync === 'waiting' && (
        <>
          <Styles.MenuNote>Finish signing in on the Google page.</Styles.MenuNote>
          {status.signInUrl && (
            <>
              <Styles.MenuLink href={status.signInUrl} target="_blank" rel="noopener noreferrer">
                Open the Google page
              </Styles.MenuLink>
              <Styles.ConfirmActions>{signInButton('Start again')}</Styles.ConfirmActions>
            </>
          )}
        </>
      )}
      {status.sync === 'choose' && status.choice && (
        <>
          <Styles.MenuNote>{`Signed in as ${status.email}.`}</Styles.MenuNote>
          <Styles.MenuNote>Google Drive already has doji settings that are different from this computer's. Which do you want to keep?</Styles.MenuNote>
          <Styles.MenuNote>{summaryLine('This computer', status.choice.local)}</Styles.MenuNote>
          <Styles.MenuNote>{summaryLine('Google Drive', status.choice.drive)}</Styles.MenuNote>
          <Styles.WrappingActions>
            <Styles.TextButton type="button" disabled={busy} onClick={() => run(() => api.choose('local'))}>
              Keep this computer's
            </Styles.TextButton>
            <Styles.TextButton type="button" disabled={busy} onClick={() => run(() => api.choose('drive'))}>
              Use Google Drive's
            </Styles.TextButton>
            {signOutButton}
          </Styles.WrappingActions>
          <Styles.MenuNote>The other copy is kept as a backup.</Styles.MenuNote>
        </>
      )}
      {(status.sync === 'idle' || status.sync === 'syncing' || status.sync === 'offline' || status.sync === 'failed') && (
        <>
          <Styles.MenuNote>{`Signed in as ${status.email}.`}</Styles.MenuNote>
          <Styles.MenuNote role="status">{syncLine(syncing ? { ...status, sync: 'syncing' } : status)}</Styles.MenuNote>
          <Styles.ConfirmActions>
            {/* Not `disabled`, which would take the keyboard away from the button just pressed. */}
            <Styles.TextButton type="button" aria-disabled={cannotSync} onClick={() => !cannotSync && syncNow()}>
              Sync now
            </Styles.TextButton>
            {signOutButton}
          </Styles.ConfirmActions>
        </>
      )}
      {status.sync === 'expired' && (
        <>
          <Styles.MenuNote>Your Google sign-in expired. Sign in again to keep syncing.</Styles.MenuNote>
          <Styles.WrappingActions>
            {signInButton('Sign in with Google')}
            {signOutButton}
          </Styles.WrappingActions>
        </>
      )}
      {problem && (
        <Styles.MenuNote role="alert" $danger>
          Could not reach Google Drive. Try again.
        </Styles.MenuNote>
      )}
    </>
  )
}
