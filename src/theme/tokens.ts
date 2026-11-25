import type { ThemeName } from '../../shared/types'

export type Theme = {
  name: ThemeName
  ui: {
    bg: string
    panel: string
    popup: string
    border: string
    separator: string
    gap: number
    text: string
    textMuted: string
    hover: string
    active: string
    accent: string
    onAccent: string
    up: string
    down: string
    preMarket: string
    postMarket: string
    shadow: string
    veil: string
    font: string
  }
  chart: {
    bg: string
    text: string
    grid: string
    border: string
    crosshair: string
    crosshairLabel: string
    up: string
    down: string
    volumeUp: string
    volumeDown: string
    rsi: string
    rsiMa: string
    rsiBand: string
    rsiLevel: string
    line: string
    volumeMa: string
    bandBasis: string
    band: string
    macd: string
    macdSignal: string
    levels: string
  }
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif"
const ACCENT = '#2962FF'
const UP = '#089981'
const DOWN = '#F23645'
const MUTED = '#787B86'
const PRE_MARKET = '#FF9800'
const POST_MARKET = '#5B9CF6'

const shared = {
  up: UP,
  down: DOWN,
  rsi: '#7E57C2',
  rsiMa: '#FDD835',
  rsiBand: 'rgba(126, 87, 194, 0.1)',
  rsiLevel: MUTED,
  line: ACCENT,
  volumeMa: '#FF9800',
  bandBasis: '#FF6D00',
  band: '#2196F3',
  macd: ACCENT,
  macdSignal: '#FF6D00',
  levels: '#FFFFFF',
}

const DOJI_VIOLET = '#7C5CFF'
const DOJI_UP = '#3CC68A'
const DOJI_DOWN = '#F25C69'
const DOJI_GOLD = '#F0A04B'

export const themes: Record<ThemeName, Theme> = {
  doji: {
    name: 'doji',
    ui: {
      bg: '#151412',
      panel: '#0E0D0C',
      popup: '#1C1A17',
      border: '#2E2B27',
      separator: '#24221F',
      gap: 4,
      text: '#ECE7DE',
      textMuted: '#8F897E',
      hover: '#24221F',
      active: '#2A2347',
      accent: DOJI_VIOLET,
      onAccent: '#FFFFFF',
      up: DOJI_UP,
      down: DOJI_DOWN,
      preMarket: DOJI_GOLD,
      postMarket: '#7DB4F0',
      shadow: 'rgba(0, 0, 0, 0.6)',
      veil: 'rgba(21, 20, 18, 0.6)',
      font: FONT,
    },
    chart: {
      bg: '#151412',
      text: '#B5AFA4',
      grid: 'rgba(60, 56, 50, 0.45)',
      border: '#2E2B27',
      crosshair: '#9A9488',
      crosshairLabel: '#3A3631',
      up: DOJI_UP,
      down: DOJI_DOWN,
      volumeUp: 'rgba(236, 231, 222, 0.32)',
      volumeDown: 'rgba(236, 231, 222, 0.32)',
      rsi: '#A08AFF',
      rsiMa: '#F2C14E',
      rsiBand: 'rgba(124, 92, 255, 0.08)',
      rsiLevel: '#8F897E',
      line: DOJI_VIOLET,
      volumeMa: DOJI_GOLD,
      bandBasis: DOJI_GOLD,
      band: '#6EC1E4',
      macd: DOJI_VIOLET,
      macdSignal: DOJI_GOLD,
      levels: '#FFFFFF',
    },
  },
  midnight: {
    name: 'midnight',
    ui: {
      bg: '#131722',
      panel: '#000000',
      popup: '#1E222D',
      border: '#2A2E39',
      separator: '#222222',
      gap: 4,
      text: '#D1D4DC',
      textMuted: MUTED,
      hover: '#2A2E39',
      active: '#142E61',
      accent: ACCENT,
      onAccent: '#FFFFFF',
      up: '#22AB94',
      down: DOWN,
      preMarket: PRE_MARKET,
      postMarket: POST_MARKET,
      shadow: 'rgba(0, 0, 0, 0.5)',
      veil: 'rgba(19, 23, 34, 0.6)',
      font: FONT,
    },
    chart: {
      ...shared,
      volumeUp: 'rgba(255, 255, 255, 0.5)',
      volumeDown: 'rgba(255, 255, 255, 0.5)',
      bg: '#131722',
      text: '#B2B5BE',
      grid: 'rgba(42, 46, 57, 0.6)',
      border: '#2A2E39',
      crosshair: '#9598A1',
      crosshairLabel: '#363A45',
    },
  },
  light: {
    name: 'light',
    ui: {
      bg: '#FFFFFF',
      panel: '#FFFFFF',
      popup: '#FFFFFF',
      border: '#E0E3EB',
      separator: '#E0E3EB',
      gap: 1,
      text: '#131722',
      textMuted: MUTED,
      hover: '#F0F3FA',
      active: '#E3EFFD',
      accent: ACCENT,
      onAccent: '#FFFFFF',
      up: UP,
      down: DOWN,
      preMarket: PRE_MARKET,
      postMarket: POST_MARKET,
      shadow: 'rgba(0, 0, 0, 0.15)',
      veil: 'rgba(255, 255, 255, 0.6)',
      font: FONT,
    },
    chart: {
      ...shared,
      volumeUp: 'rgba(19, 23, 34, 0.5)',
      volumeDown: 'rgba(19, 23, 34, 0.5)',
      bg: '#FFFFFF',
      text: '#131722',
      grid: 'rgba(42, 46, 57, 0.06)',
      border: '#E0E3EB',
      crosshair: '#9598A1',
      crosshairLabel: '#131722',
      levels: '#131722',
    },
  },
}

export const THEME_OPTIONS: { name: ThemeName; label: string }[] = [
  { name: 'doji', label: 'Doji' },
  { name: 'midnight', label: 'Midnight' },
  { name: 'light', label: 'Light' },
]

export const LINE_COLORS = ['#2962FF', '#F23645', '#089981', '#FF9800', '#9C27B0', '#00BCD4', '#FDD835', '#787B86', '#FFFFFF']
