import { displaySymbol } from '../../../shared/symbols'
import type { NewsItem } from '../../../shared/types'
import { timeAgo } from '../../domain/timeAgo'
import * as Styles from './styles'

type NewsPanelProps = {
  symbol: string
  open: boolean
  news: NewsItem[] | null | undefined
  now: number
  onToggle: () => void
}

const Headlines = ({ symbol, news, now }: Pick<NewsPanelProps, 'symbol' | 'news' | 'now'>) => {
  if (news === undefined) return <Styles.Note>Loading…</Styles.Note>
  if (news === null) return <Styles.Note>Could not load the headlines</Styles.Note>
  if (news.length === 0) return <Styles.Note>{`No recent headlines for ${displaySymbol(symbol)}`}</Styles.Note>
  return (
    <Styles.List>
      {news.map((item) => (
        <li key={item.id}>
          <Styles.Headline href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </Styles.Headline>
          <Styles.Meta>{[item.publisher, timeAgo(item.time, now)].filter(Boolean).join(' · ')}</Styles.Meta>
        </li>
      ))}
    </Styles.List>
  )
}

export const NewsPanel = ({ symbol, open, news, now, onToggle }: NewsPanelProps) => {
  const shown = displaySymbol(symbol)

  return (
    <Styles.Panel>
      <Styles.Toggle type="button" aria-label={`News for ${shown}`} aria-expanded={open} onClick={onToggle}>
        <Styles.Label>News</Styles.Label>
        <Styles.Muted>{shown}</Styles.Muted>
        <Styles.Chevron $open={open}>▲</Styles.Chevron>
      </Styles.Toggle>
      {open && (
        <Styles.Body>
          <Headlines symbol={symbol} news={news} now={now} />
        </Styles.Body>
      )}
    </Styles.Panel>
  )
}
