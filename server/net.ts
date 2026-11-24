type Init = { headers: Record<string, string>; signal?: AbortSignal }

export const withTimeout =
  <Result>(fetchImpl: (url: string, init: Init) => Promise<Result>, ms: number) =>
  (url: string, init: Init): Promise<Result> =>
    fetchImpl(url, { ...init, signal: AbortSignal.timeout(ms) })
