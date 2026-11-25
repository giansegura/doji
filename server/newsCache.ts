import type { NewsItem } from '../shared/types'

export type NewsCache = { get: (symbol: string) => Promise<NewsItem[]> }

type Kept = { at: number; news: NewsItem[] }

export const NEWS_KEEP_MS = 15 * 60_000

export const createNewsCache = (deps: { fetchNews: (symbol: string) => Promise<NewsItem[]>; now: () => Date }): NewsCache => {
  const kept = new Map<string, Kept>()
  const running = new Map<string, Promise<NewsItem[]>>()

  const refresh = async (key: string): Promise<NewsItem[]> => {
    const previous = kept.get(key)
    try {
      const news = await deps.fetchNews(key)
      kept.set(key, { at: deps.now().getTime(), news })
      return news
    } catch (error) {
      if (previous) return previous.news
      throw error
    }
  }

  const get = async (symbol: string): Promise<NewsItem[]> => {
    const key = symbol.toUpperCase()
    const previous = kept.get(key)
    if (previous && deps.now().getTime() - previous.at < NEWS_KEEP_MS) return previous.news
    const started = running.get(key) ?? refresh(key).finally(() => running.delete(key))
    running.set(key, started)
    return started
  }

  return { get }
}
