import { useEffect, useRef, useState } from 'react'
import type { CompanyProfile } from '../../shared/types'
import { getProfile } from '../api/client'

type Loaded = { symbol: string; profile: CompanyProfile | null }

export const useCompanyProfile = (
  symbol: string,
  open: boolean,
  fetchProfile: (symbol: string) => Promise<CompanyProfile> = getProfile,
): CompanyProfile | null | undefined => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const fetchRef = useRef(fetchProfile)

  useEffect(() => {
    fetchRef.current = fetchProfile
  }, [fetchProfile])

  useEffect(() => {
    if (!open) return undefined
    let active = true
    fetchRef
      .current(symbol)
      .then((profile) => {
        if (active) setLoaded({ symbol, profile })
      })
      .catch(() => {
        if (active) setLoaded({ symbol, profile: null })
      })
    return () => {
      active = false
    }
  }, [symbol, open])

  return loaded?.symbol === symbol ? loaded.profile : undefined
}
