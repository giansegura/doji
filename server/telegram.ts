export type TelegramStatus = { connected: boolean; bot: string | null; linked: boolean }

export type TelegramErrorKind = 'invalid_token' | 'not_connected' | 'no_message' | 'not_linked' | 'unavailable'

export type TelegramFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; text: () => Promise<string> }>

type Config = { token: string; bot: string; chatId?: number }

export type TelegramStore = { load: () => Promise<unknown>; save: (config: Config) => Promise<void>; clear: () => Promise<void> }

export type Telegram = {
  status: () => Promise<TelegramStatus>
  connect: (token: string) => Promise<TelegramStatus>
  link: () => Promise<TelegramStatus>
  send: (text: string) => Promise<boolean>
  test: () => Promise<void>
  disconnect: () => Promise<TelegramStatus>
}

const TOKEN = /^\d{5,15}:[\w-]{30,60}$/
const TEST_MESSAGE = 'doji is connected. Your price alerts will arrive here.'
const DISCONNECTED: TelegramStatus = { connected: false, bot: null, linked: false }
const UPDATES_PAGE = 100
const MAX_UPDATE_PAGES = 20

const ERROR_NAME = 'TelegramError'

export const telegramError = (kind: TelegramErrorKind): Error & { kind: TelegramErrorKind } =>
  Object.assign(new Error(kind), { kind, name: ERROR_NAME })

export const isTelegramError = (error: unknown): error is Error & { kind: TelegramErrorKind } =>
  error instanceof Error && error.name === ERROR_NAME

const configFrom = (raw: unknown): Config | null => {
  const config = raw as Partial<Config> | null
  if (typeof config?.token !== 'string' || !TOKEN.test(config.token) || typeof config.bot !== 'string') return null
  return { token: config.token, bot: config.bot, ...(typeof config.chatId === 'number' ? { chatId: config.chatId } : {}) }
}

const statusOf = (config: Config | null): TelegramStatus =>
  config ? { connected: true, bot: config.bot, linked: config.chatId !== undefined } : DISCONNECTED

const chatOf = (update: unknown): number | null => {
  const message = (update as { message?: { chat?: { id?: unknown } }; edited_message?: { chat?: { id?: unknown } } } | null)
  const id = message?.message?.chat?.id ?? message?.edited_message?.chat?.id
  return typeof id === 'number' ? id : null
}

const lastUpdateId = (updates: unknown[]): number | null => {
  const id = (updates.at(-1) as { update_id?: unknown } | undefined)?.update_id
  return typeof id === 'number' ? id : null
}

export const createTelegram = (deps: { fetch: TelegramFetch; apiUrl: string; store: TelegramStore }): Telegram => {
  let generation = 0

  const load = async (): Promise<Config | null> => configFrom(await deps.store.load().catch(() => null))

  const call = async (token: string, method: string, body?: object): Promise<{ ok: boolean; result?: unknown }> => {
    try {
      const answer = await deps.fetch(`${deps.apiUrl}/bot${token}/${method}`, {
        method: body ? 'POST' : 'GET',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      const parsed = JSON.parse(await answer.text()) as { ok?: unknown; result?: unknown }
      return { ok: answer.status === 200 && parsed.ok === true, result: parsed.result }
    } catch {
      throw telegramError('unavailable')
    }
  }

  const connect = async (raw: string): Promise<TelegramStatus> => {
    generation += 1
    const token = raw.trim()
    if (!TOKEN.test(token)) throw telegramError('invalid_token')
    const answer = await call(token, 'getMe')
    const bot = (answer.result as { username?: unknown } | undefined)?.username
    if (!answer.ok || typeof bot !== 'string') throw telegramError('invalid_token')
    const config = { token, bot }
    await deps.store.save(config)
    return statusOf(config)
  }

  const newestChat = async (token: string): Promise<number | undefined> => {
    let chat: number | undefined
    let offset: number | null = null
    for (let page = 0; page < MAX_UPDATE_PAGES; page += 1) {
      const answer = await call(token, offset === null ? 'getUpdates' : `getUpdates?offset=${offset}`)
      const updates = answer.ok && Array.isArray(answer.result) ? answer.result : []
      chat = updates.map(chatOf).filter((id): id is number => id !== null).at(-1) ?? chat
      const last = lastUpdateId(updates)
      if (updates.length < UPDATES_PAGE || last === null) return chat
      offset = last + 1
    }
    return chat
  }

  const link = async (): Promise<TelegramStatus> => {
    const started = generation
    const config = await load()
    if (!config) throw telegramError('not_connected')
    const chatId = await newestChat(config.token)
    if (generation !== started) throw telegramError('not_connected')
    if (chatId === undefined) throw telegramError('no_message')
    const linked = { ...config, chatId }
    await deps.store.save(linked)
    return statusOf(linked)
  }

  const deliver = async (config: Config | null, text: string): Promise<boolean> => {
    if (!config || config.chatId === undefined) return false
    const answer = await call(config.token, 'sendMessage', { chat_id: config.chatId, text, disable_web_page_preview: true })
    return answer.ok
  }

  const send = async (text: string): Promise<boolean> => deliver(await load(), text).catch(() => false)

  const test = async (): Promise<void> => {
    const config = await load()
    if (!config || config.chatId === undefined) throw telegramError('not_linked')
    if (!(await deliver(config, TEST_MESSAGE))) throw telegramError('unavailable')
  }

  const disconnect = async (): Promise<TelegramStatus> => {
    generation += 1
    await deps.store.clear()
    return DISCONNECTED
  }

  return { status: async () => statusOf(await load()), connect, link, send, test, disconnect }
}
