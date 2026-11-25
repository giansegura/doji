import { displaySymbol, priceDigits } from '../shared/symbols'
import type { AlertEvent } from '../shared/types'

const priceOf = (symbol: string, value: number): string => value.toFixed(priceDigits(symbol, value))

export const alertMessage = (alert: AlertEvent): string =>
  [
    `🔔 ${displaySymbol(alert.symbol)} crossed ${priceOf(alert.symbol, alert.level)} going ${alert.direction}, now at ${priceOf(alert.symbol, alert.price)}`,
    ...(alert.text ? [alert.text] : []),
  ].join(' · ')
