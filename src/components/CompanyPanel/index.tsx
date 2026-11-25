import { displaySymbol } from '../../../shared/symbols'
import type { CompanyProfile } from '../../../shared/types'
import { profileRows } from '../../domain/companyProfile'
import * as Styles from './styles'

type CompanyPanelProps = {
  symbol: string
  open: boolean
  profile: CompanyProfile | null | undefined
  nextEarnings: string | null
  onToggle: () => void
}

const hostOf = (website: string): string => {
  try {
    return new URL(website).hostname.replace(/^www\./, '')
  } catch {
    return website
  }
}

const Details = ({ symbol, profile, nextEarnings }: Omit<CompanyPanelProps, 'open' | 'onToggle'>) => {
  if (profile === undefined) return <Styles.Note>Loading…</Styles.Note>
  if (profile === null) return <Styles.Note>{`No company data for ${displaySymbol(symbol)}`}</Styles.Note>
  return (
    <>
      {profile.name && <Styles.Name>{profile.name}</Styles.Name>}
      <Styles.Rows>
        {profileRows(profile, symbol, nextEarnings).map((row) => (
          <Styles.Row key={row.label}>
            <Styles.Term>{row.label}</Styles.Term>
            <Styles.Value>{row.value}</Styles.Value>
          </Styles.Row>
        ))}
      </Styles.Rows>
      {profile.summary && <Styles.Summary title={profile.summary}>{profile.summary}</Styles.Summary>}
      {profile.website && (
        <Styles.Site href={profile.website} target="_blank" rel="noreferrer">
          {hostOf(profile.website)}
        </Styles.Site>
      )}
    </>
  )
}

export const CompanyPanel = ({ symbol, open, profile, nextEarnings, onToggle }: CompanyPanelProps) => {
  const shown = displaySymbol(symbol)

  return (
    <Styles.Panel>
      <Styles.Toggle type="button" aria-label={`Company sheet for ${shown}`} aria-expanded={open} onClick={onToggle}>
        <Styles.Label>Company</Styles.Label>
        <Styles.Muted>{shown}</Styles.Muted>
        <Styles.Chevron $open={open}>▲</Styles.Chevron>
      </Styles.Toggle>
      {open && (
        <Styles.Body>
          <Details symbol={symbol} profile={profile} nextEarnings={nextEarnings} />
        </Styles.Body>
      )}
    </Styles.Panel>
  )
}
