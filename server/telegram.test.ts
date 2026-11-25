import { expect, test } from 'vitest'
import { type TelegramFetch, createTelegram, isTelegramError } from './telegram'

const TOKEN = '123456789:AAbbCCddEEffGGhhIIjjKKllMMnnOOppQQ'

const fakeTelegram = (over: { updates?: unknown[]; badToken?: boolean } = {}) => {
  const calls: { url: string; body?: unknown }[] = []
  const fetch: TelegramFetch = async (url, init) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined })
    const reply = (status: number, body: unknown) => ({ status, text: async () => JSON.stringify(body) })
    if (url.endsWith('/getMe')) return over.badToken ? reply(401, { ok: false }) : reply(200, { ok: true, result: { username: 'doji_alerts_bot' } })
    if (url.endsWith('/getUpdates')) return reply(200, { ok: true, result: over.updates ?? [] })
    if (url.endsWith('/sendMessage')) return reply(200, { ok: true, result: {} })
    return reply(404, { ok: false })
  }
  return { fetch, calls }
}

const memory = () => {
  const box: { config: unknown } = { config: null }
  return {
    box,
    store: {
      load: async () => box.config,
      save: async (config: unknown) => {
        box.config = config
      },
      clear: async () => {
        box.config = null
      },
    },
  }
}

const API = 'https://api.example'

test('Should connect a bot from its token and keep the token on the computer only', async () => {
  const { fetch, calls } = fakeTelegram()
  const { box, store } = memory()
  const telegram = createTelegram({ fetch, apiUrl: API, store })
  expect(await telegram.status()).toEqual({ connected: false, bot: null, linked: false })
  expect(await telegram.connect(` ${TOKEN} `)).toEqual({ connected: true, bot: 'doji_alerts_bot', linked: false })
  expect(calls[0].url).toBe(`${API}/bot${TOKEN}/getMe`)
  expect(box.config).toEqual({ token: TOKEN, bot: 'doji_alerts_bot' })
  expect(JSON.stringify(await telegram.status())).not.toContain(TOKEN)
})

test('Should refuse a token that does not look like one or that Telegram does not know', async () => {
  const { store } = memory()
  const bad = createTelegram({ fetch: fakeTelegram({ badToken: true }).fetch, apiUrl: API, store })
  await expect(bad.connect('hola')).rejects.toSatisfy((error: unknown) => isTelegramError(error) && error.kind === 'invalid_token')
  await expect(bad.connect(TOKEN)).rejects.toSatisfy((error: unknown) => isTelegramError(error) && error.kind === 'invalid_token')
})

test('Should link the chat of the last person who wrote to the bot', async () => {
  const updates = [
    { update_id: 1, message: { chat: { id: 111 }, text: 'hola' } },
    { update_id: 2, message: { chat: { id: 222 }, text: '/start' } },
  ]
  const { fetch } = fakeTelegram({ updates })
  const { box, store } = memory()
  const telegram = createTelegram({ fetch, apiUrl: API, store })
  await telegram.connect(TOKEN)
  expect(await telegram.link()).toEqual({ connected: true, bot: 'doji_alerts_bot', linked: true })
  expect(box.config).toEqual({ token: TOKEN, bot: 'doji_alerts_bot', chatId: 222 })
})

test('Should ask to write to the bot first when nobody has', async () => {
  const { store } = memory()
  const telegram = createTelegram({ fetch: fakeTelegram().fetch, apiUrl: API, store })
  await telegram.connect(TOKEN)
  await expect(telegram.link()).rejects.toSatisfy((error: unknown) => isTelegramError(error) && error.kind === 'no_message')
})

test('Should send messages to the linked chat and nothing while unlinked', async () => {
  const { fetch, calls } = fakeTelegram({ updates: [{ update_id: 1, message: { chat: { id: 222 } } }] })
  const { store } = memory()
  const telegram = createTelegram({ fetch, apiUrl: API, store })
  await telegram.connect(TOKEN)
  expect(await telegram.send('hola')).toBe(false)
  await expect(telegram.test()).rejects.toSatisfy((error: unknown) => isTelegramError(error) && error.kind === 'not_linked')
  await telegram.link()
  expect(await telegram.send('KO crossed 60.00 going up')).toBe(true)
  await telegram.test()
  const sent = calls.filter((call) => call.url.endsWith('/sendMessage'))
  expect(sent.map((call) => call.body)).toEqual([
    { chat_id: 222, text: 'KO crossed 60.00 going up', disable_web_page_preview: true },
    { chat_id: 222, text: 'doji is connected. Your price alerts will arrive here.', disable_web_page_preview: true },
  ])
})

test('Should forget the bot on disconnect', async () => {
  const { store, box } = memory()
  const telegram = createTelegram({ fetch: fakeTelegram().fetch, apiUrl: API, store })
  await telegram.connect(TOKEN)
  expect(await telegram.disconnect()).toEqual({ connected: false, bot: null, linked: false })
  expect(box.config).toBeNull()
})

test('Should read every page of pending messages and link the chat of the newest one', async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({ update_id: index + 1, message: { chat: { id: 111 }, text: 'spam' } }))
  const second = [{ update_id: 101, message: { chat: { id: 222 }, text: 'hola' } }]
  const urls: string[] = []
  const fetch: TelegramFetch = async (url) => {
    urls.push(url)
    const reply = (body: unknown) => ({ status: 200, text: async () => JSON.stringify(body) })
    if (url.endsWith('/getUpdates')) return reply({ ok: true, result: first })
    if (url.endsWith('/getUpdates?offset=101')) return reply({ ok: true, result: second })
    return reply({ ok: true, result: [] })
  }
  const { box, store } = memory()
  box.config = { token: TOKEN, bot: 'doji_alerts_bot' }
  const telegram = createTelegram({ fetch, apiUrl: API, store })
  expect(await telegram.link()).toEqual({ connected: true, bot: 'doji_alerts_bot', linked: true })
  expect(box.config).toMatchObject({ chatId: 222 })
  expect(urls).toEqual([`${API}/bot${TOKEN}/getUpdates`, `${API}/bot${TOKEN}/getUpdates?offset=101`])
})

test('Should not bring a bot back when it was disconnected while linking', async () => {
  let release: () => void = () => undefined
  const waiting = new Promise<void>((done) => (release = done))
  const fetch: TelegramFetch = async () => {
    await waiting
    return { status: 200, text: async () => JSON.stringify({ ok: true, result: [{ update_id: 1, message: { chat: { id: 111 } } }] }) }
  }
  const { box, store } = memory()
  box.config = { token: TOKEN, bot: 'doji_alerts_bot' }
  const telegram = createTelegram({ fetch, apiUrl: API, store })
  const linking = telegram.link()
  await telegram.disconnect()
  release()
  await expect(linking).rejects.toSatisfy((error: unknown) => isTelegramError(error) && error.kind === 'not_connected')
  expect(box.config).toBeNull()
})
