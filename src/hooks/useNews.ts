import { useEffect, useRef, useState } from 'react'
import type { NewsItem } from '../../shared/types'
import { getNews } from '../api/client'

type Loaded = { symbol: string; news: NewsItem[] | null }

export const useNews = (
  symbol: string,
  open: boolean,
  fetchNews: (symbol: string) => Promise<NewsItem[]> = getNews,
): NewsItem[] | null | undefined => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const fetchRef = useRef(fetchNews)

  useEffect(() => {
    fetchRef.current = fetchNews
  }, [fetchNews])

  useEffect(() => {
    if (!open) return undefined
    let active = true
    fetchRef
      .current(symbol)
      .then((news) => {
        if (active) setLoaded({ symbol, news })
      })
      .catch(() => {
        if (active) setLoaded({ symbol, news: null })
      })
    return () => {
      active = false
    }
  }, [symbol, open])

  return loaded?.symbol === symbol ? loaded.news : undefined
}
