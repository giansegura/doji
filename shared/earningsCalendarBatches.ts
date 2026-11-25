import type { Earnings } from './types'

export const MAX_CALENDAR_SYMBOLS = 500

export type CalendarAnswer = { earnings: Record<string, Earnings>; pending: number }

export const askInBatches = async (symbols: string[], ask: (batch: string[]) => Promise<CalendarAnswer>): Promise<CalendarAnswer> => {
  const batches = Array.from({ length: Math.ceil(symbols.length / MAX_CALENDAR_SYMBOLS) }, (_, index) =>
    symbols.slice(index * MAX_CALENDAR_SYMBOLS, (index + 1) * MAX_CALENDAR_SYMBOLS),
  )
  const answers = await Promise.all(batches.map(ask))
  return {
    earnings: Object.assign({}, ...answers.map((answer) => answer.earnings)),
    pending: Math.max(0, ...answers.map((answer) => answer.pending)),
  }
}
