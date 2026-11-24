import type { ThemeName } from '../../shared/types'

export type Theme = {
  name: ThemeName
  ui: {
    bg: string
    panel: string
    border: string
    text: string
    textMuted: string
    hover: string
    active: string
    accent: string
    onAccent: string
    up: string
    down: string
    shadow: string
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
  }
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif"
const ACCENT = '#2962FF'
const UP = '#089981'
const DOWN = '#F23645'
const MUTED = '#787B86'

const shared = {
  up: UP,
  down: DOWN,
  rsi: '#7E57C2',
  rsiMa: '#FDD835',
  rsiBand: 'rgba(126, 87, 194, 0.1)',
  rsiLevel: MUTED,
  line: ACCENT,
}

export const themes: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    ui: {
      bg: '#131722',
      panel: '#1E222D',
      border: '#2A2E39',
      text: '#D1D4DC',
      textMuted: MUTED,
      hover: '#2A2E39',
      active: '#142E61',
      accent: ACCENT,
      onAccent: '#FFFFFF',
      up: UP,
      down: DOWN,
      shadow: 'rgba(0, 0, 0, 0.5)',
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
      border: '#E0E3EB',
      text: '#131722',
      textMuted: MUTED,
      hover: '#F0F3FA',
      active: '#E3EFFD',
      accent: ACCENT,
      onAccent: '#FFFFFF',
      up: UP,
      down: DOWN,
      shadow: 'rgba(0, 0, 0, 0.15)',
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
    },
  },
}

export const LINE_COLORS = ['#2962FF', '#F23645', '#089981', '#FF9800', '#9C27B0', '#00BCD4', '#FDD835', '#787B86']
