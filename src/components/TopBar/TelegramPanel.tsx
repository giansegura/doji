import { type FormEvent, useEffect, useState } from 'react'
import { type TelegramApi, type TelegramStatus, isApiError, telegramApi } from '../../api/client'
import * as Styles from './styles'

type TelegramPanelProps = { api?: TelegramApi }

type Note = { text: string; problem: boolean } | null

const PROBLEMS: Record<string, string> = {
  invalid_token: 'Telegram did not accept that token.',
  no_message: 'The bot has not received any message yet. Send it one and try again.',
  not_linked: 'Link the chat first.',
  not_connected: 'Connect a bot first.',
}

const problemOf = (error: unknown): string => (isApiError(error) && PROBLEMS[error.code]) || 'Could not reach Telegram. Try again later.'

export const TelegramPanel = ({ api = telegramApi }: TelegramPanelProps) => {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [token, setToken] = useState('')
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
        if (active) setStatus({ connected: false, bot: null, linked: false })
      })
    return () => {
      active = false
    }
  }, [api])

  const run = async (work: () => Promise<TelegramStatus | null>, done: string | null = null) => {
    setBusy(true)
    setNote(null)
    try {
      const next = await work()
      if (next) setStatus(next)
      if (done) setNote({ text: done, problem: false })
    } catch (error) {
      setNote({ text: problemOf(error), problem: true })
    } finally {
      setBusy(false)
    }
  }

  const handleConnect = (event: FormEvent) => {
    event.preventDefault()
    run(async () => {
      const next = await api.connect(token)
      setToken('')
      return next
    })
  }

  const disconnect = () => run(() => api.disconnect())

  if (!status) return null

  return (
    <>
      <Styles.MenuSection>Telegram alerts</Styles.MenuSection>
      {!status.connected && (
        <Styles.TelegramForm onSubmit={handleConnect}>
          <Styles.MenuNote>Get your price alerts on your phone, even with doji closed in the browser. Create a bot with @BotFather and paste its token.</Styles.MenuNote>
          <Styles.TokenInput
            type="password"
            aria-label="Bot token"
            placeholder="Bot token"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <Styles.TextButton type="submit" disabled={busy || token.trim() === ''}>
            Connect
          </Styles.TextButton>
        </Styles.TelegramForm>
      )}
      {status.connected && !status.linked && (
        <>
          <Styles.MenuNote>{`@${status.bot} connected. Open it in Telegram, send it any message, then press Link chat.`}</Styles.MenuNote>
          <Styles.ConfirmActions>
            <Styles.TextButton type="button" disabled={busy} onClick={() => run(() => api.link())}>
              Link chat
            </Styles.TextButton>
            <Styles.TextButton type="button" $danger disabled={busy} onClick={disconnect}>
              Disconnect
            </Styles.TextButton>
          </Styles.ConfirmActions>
        </>
      )}
      {status.linked && (
        <>
          <Styles.MenuNote>{`Alerts go to @${status.bot}.`}</Styles.MenuNote>
          <Styles.ConfirmActions>
            <Styles.TextButton
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api.test()
                  return null
                }, 'Test message sent.')
              }
            >
              Send test message
            </Styles.TextButton>
            <Styles.TextButton type="button" $danger disabled={busy} onClick={disconnect}>
              Disconnect
            </Styles.TextButton>
          </Styles.ConfirmActions>
        </>
      )}
      {note && (
        <Styles.MenuNote role={note.problem ? 'alert' : 'status'} $danger={note.problem}>
          {note.text}
        </Styles.MenuNote>
      )}
    </>
  )
}
