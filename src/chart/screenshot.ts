import type { IChartApi } from 'lightweight-charts'
import type { Timeframe } from '../../shared/types'

const twoDigits = (value: number): string => String(value).padStart(2, '0')

export const imageName = (symbol: string, timeframe: Timeframe, date: Date): string => {
  const day = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
  return `doji-${symbol.replace(/[^A-Za-z0-9.-]/g, '')}-1${timeframe}-${day}.png`
}

export const saveChartImage = (chart: IChartApi, name: string): void => {
  chart.takeScreenshot(true).toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  })
}
