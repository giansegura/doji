import type { CompanyProfile } from '../../shared/types'
import type { YahooSummary } from './yahooSummary'

export type ProfileSource = { get: (symbol: string) => Promise<CompanyProfile | null> }

export type ProfileStore = { load: () => Promise<unknown>; save: (data: unknown) => Promise<void> }

type Kept = { at: number; profile: CompanyProfile | null }

const MODULES = 'price,summaryDetail,assetProfile,defaultKeyStatistics'
const KEEP_MS = 24 * 3_600_000
const RETRY_MS = 10 * 60_000

type Json = Record<string, unknown>

const objectOf = (value: unknown): Json => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {})

const numberOf = (value: unknown): number | null => {
  const raw = typeof value === 'number' ? value : objectOf(value).raw
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

const textOf = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)

export const parseProfile = (json: unknown): CompanyProfile | null => {
  const result = objectOf((objectOf(objectOf(json).quoteSummary).result as unknown[] | undefined)?.[0])
  if (Object.keys(result).length === 0) return null
  const price = objectOf(result.price)
  const detail = objectOf(result.summaryDetail)
  const company = objectOf(result.assetProfile)
  const stats = objectOf(result.defaultKeyStatistics)
  return {
    kind: textOf(price.quoteType),
    name: textOf(price.longName) ?? textOf(price.shortName),
    currency: textOf(price.currency),
    marketCap: numberOf(detail.marketCap) ?? numberOf(price.marketCap),
    totalAssets: numberOf(detail.totalAssets),
    trailingPE: numberOf(detail.trailingPE),
    forwardPE: numberOf(detail.forwardPE),
    dividendYield: numberOf(detail.dividendYield) ?? numberOf(detail.yield),
    beta: numberOf(detail.beta),
    high52: numberOf(detail.fiftyTwoWeekHigh),
    low52: numberOf(detail.fiftyTwoWeekLow),
    sector: textOf(company.sector),
    industry: textOf(company.industry),
    category: textOf(stats.category),
    country: textOf(company.country),
    employees: numberOf(company.fullTimeEmployees),
    website: textOf(company.website),
    summary: textOf(company.longBusinessSummary),
  }
}

const keptFrom = (raw: unknown): [string, Kept][] =>
  Object.entries(objectOf(raw)).flatMap(([symbol, value]): [string, Kept][] => {
    const kept = objectOf(value)
    return typeof kept.at === 'number' && 'profile' in kept ? [[symbol, { at: kept.at, profile: kept.profile as CompanyProfile | null }]] : []
  })

export const createProfileSource = (deps: { summary: YahooSummary; now: () => Date; store?: ProfileStore }): ProfileSource => {
  const kept = new Map<string, Kept>()
  let saving: Promise<void> = Promise.resolve()
  const loaded = (deps.store?.load() ?? Promise.resolve(null))
    .then((raw) => keptFrom(raw).forEach(([symbol, entry]) => kept.set(symbol, entry)))
    .catch(() => undefined)

  const persist = (): Promise<void> => {
    const store = deps.store
    if (!store) return Promise.resolve()
    saving = saving.then(() => store.save(Object.fromEntries(kept))).catch(() => undefined)
    return saving
  }

  const running = new Map<string, Promise<CompanyProfile | null>>()

  const fetchProfile = async (key: string): Promise<CompanyProfile | null> => {
    const now = deps.now().getTime()
    const previous = kept.get(key)
    if (previous && now - previous.at < KEEP_MS) return previous.profile
    try {
      const profile = parseProfile(await deps.summary.ask(key, MODULES))
      kept.set(key, { at: now, profile })
      await persist()
      return profile
    } catch {
      const fallback = previous?.profile ?? null
      kept.set(key, { at: now - KEEP_MS + RETRY_MS, profile: fallback })
      return fallback
    }
  }

  const get = async (symbol: string): Promise<CompanyProfile | null> => {
    await loaded
    const key = symbol.toUpperCase()
    const pending = running.get(key) ?? fetchProfile(key).finally(() => running.delete(key))
    running.set(key, pending)
    return pending
  }

  return { get }
}
