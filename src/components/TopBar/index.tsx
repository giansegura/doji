import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react'
import { MAX_SMAS, SMA_COLORS, SMA_MAX_LENGTH, SMA_MIN_LENGTH } from '../../../shared/limits'
import { displaySymbol } from '../../../shared/symbols'
import type {
  AppState,
  ChartSettings,
  ChartType,
  CursorMode,
  Indicators,
  ScaleMode,
  SmaConfig,
  ThemeName,
  Timeframe,
} from '../../../shared/types'
import { newId } from '../../domain/newId'
import { SMA_WIDTHS, addSma } from '../../domain/smaConfig'
import { THEME_OPTIONS, themes } from '../../theme/tokens'
import { Logo } from '../Logo'
import { ConfigPanel } from './ConfigPanel'
import { TelegramPanel } from './TelegramPanel'
import { StudiesPanel } from './StudiesPanel'
import { NumberField } from './NumberField'
import * as Styles from './styles'

type TopBarProps = {
  symbol: string
  timeframe: Timeframe
  theme: ThemeName
  indicators: Indicators
  notice: string | null
  onOpenSearch: () => void
  onTimeframe: (timeframe: Timeframe) => void
  onTheme: (theme: ThemeName) => void
  onIndicators: (indicators: Indicators) => void
  chart: ChartSettings
  onChart: (chart: ChartSettings) => void
  onScreenshot: () => void
  onOpenCalendar?: () => void
  onExportConfig: () => void
  onImportConfig: (config: AppState) => void
  split: boolean
  onSplit: () => void
}

const toggleKind = (item: SmaConfig): SmaConfig => {
  const { kind, ...simple } = item
  return kind === 'ema' ? simple : { ...simple, kind: 'ema' }
}

const TIMEFRAMES: Timeframe[] = ['D', 'W', 'M']
const RSI_MIN_LENGTH = 2
const RSI_MAX_LENGTH = 100

const CHART_TYPES: [ChartType, string][] = [
  ['candles', 'Candles'],
  ['bars', 'Bars'],
  ['line', 'Line'],
  ['area', 'Area'],
  ['baseline', 'Baseline'],
]
const SCALE_MODES: [ScaleMode, string][] = [
  ['normal', 'Normal'],
  ['log', 'Logarithmic'],
  ['percent', 'Percent'],
  ['indexed', 'Indexed to 100'],
]
const CURSOR_MODES: [CursorMode, string][] = [
  ['normal', 'Free'],
  ['magnet', 'Magnet to close'],
  ['magnetOhlc', 'Magnet to OHLC'],
]

type MenuName = 'indicators' | 'chart' | 'config' | 'theme'

const MENU_KEYS: Record<string, (at: number, count: number) => number> = {
  ArrowDown: (at) => at + 1,
  ArrowUp: (at) => at - 1,
  Home: () => 0,
  End: (_, count) => count - 1,
}

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M2.5 6h2.7l1.1-1.8h5.4L12.8 6h2.7v8h-13z" strokeLinejoin="round" />
    <circle cx="9" cy="9.8" r="2.6" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M3 4.5h12v10.5H3zM3 7.5h12M6 3v3M12 3v3" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M7.6 12.2h2.8M7.6 10.2h2.8M7.6 10.2v4" strokeLinecap="round" />
  </svg>
)

const SplitIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M2.5 3.5h13v11h-13zM9 3.5v11" strokeLinejoin="round" />
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="8" cy="8" r="5" />
    <path d="M12 12l4 4" strokeLinecap="round" />
  </svg>
)

const PaletteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M9 2.5a6.5 6.5 0 1 0 0 13c1 0 1.4-.6 1.4-1.3 0-.9-.8-1.2-.8-2 0-.7.6-1.2 1.3-1.2h1.6a3 3 0 0 0 3-3C15.5 4.9 12.6 2.5 9 2.5z" strokeLinejoin="round" />
    <circle cx="5.6" cy="8.6" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="7.6" cy="5.6" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="11.2" cy="5.6" r="0.9" fill="currentColor" stroke="none" />
  </svg>
)

export const TopBar = ({
  symbol,
  timeframe,
  theme,
  indicators,
  notice,
  onOpenSearch,
  onTimeframe,
  onTheme,
  onIndicators,
  chart,
  onChart,
  onScreenshot,
  onOpenCalendar,
  onExportConfig,
  onImportConfig,
  split,
  onSplit,
}: TopBarProps) => {
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null)
  const [styleOpenId, setStyleOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)
  const themeButtonRef = useRef<HTMLButtonElement>(null)
  const themeOptionsRef = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!openMenu) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !themeRef.current?.contains(target)) setOpenMenu(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('pointerdown', closeOnOutside)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('pointerdown', closeOnOutside)
    }
  }, [openMenu])

  useEffect(() => {
    if (openMenu !== 'theme') return
    themeOptionsRef.current[Math.max(THEME_OPTIONS.findIndex((option) => option.name === theme), 0)]?.focus()
  }, [openMenu, theme])

  const toggleMenu = (name: MenuName) => setOpenMenu((current) => (current === name ? null : name))

  const closeThemes = () => {
    setOpenMenu(null)
    themeButtonRef.current?.focus()
  }

  const pickTheme = (name: ThemeName) => {
    onTheme(name)
    closeThemes()
  }

  const handleThemeKey = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      closeThemes()
      return
    }
    const options = themeOptionsRef.current
    const at = options.findIndex((option) => option === document.activeElement)
    const target = MENU_KEYS[event.key]?.(at, options.length)
    if (target === undefined) return
    event.preventDefault()
    options[(target + options.length) % options.length]?.focus()
  }

  const setRsi = (patch: Partial<Indicators['rsi']>) => onIndicators({ ...indicators, rsi: { ...indicators.rsi, ...patch } })

  const setSma = (sma: SmaConfig[]) => onIndicators({ ...indicators, sma })

  const patchSma = (id: string, patch: Partial<SmaConfig>) =>
    setSma(indicators.sma.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const handleAddSma = () => {
    const next = addSma(indicators.sma, newId)
    if (next !== indicators.sma) setSma(next)
  }

  return (
    <Styles.Bar>
      <Styles.Brand aria-label="doji" title="doji">
        <Logo size={22} />
      </Styles.Brand>
      <Styles.SymbolButton type="button" aria-label={displaySymbol(symbol)} onClick={onOpenSearch}>
        <SearchIcon />
        {displaySymbol(symbol)}
      </Styles.SymbolButton>
      <Styles.Divider />
      {TIMEFRAMES.map((option) => (
        <Styles.Button
          key={option}
          type="button"
          aria-pressed={option === timeframe}
          $active={option === timeframe}
          onClick={() => onTimeframe(option)}
        >
          {option}
        </Styles.Button>
      ))}
      <Styles.Button
        type="button"
        title="Two charts side by side"
        aria-label="Two charts"
        aria-pressed={split}
        $active={split}
        onClick={onSplit}
      >
        <SplitIcon />
      </Styles.Button>
      <Styles.Divider />
      <Styles.Menus ref={menuRef}>
      <Styles.MenuAnchor>
        <Styles.Button type="button" aria-expanded={openMenu === 'indicators'} onClick={() => toggleMenu('indicators')}>
          Indicators
        </Styles.Button>
        {openMenu === 'indicators' && (
          <Styles.Menu>
            <Styles.MenuRow>
              <input
                type="checkbox"
                checked={indicators.volume.visible}
                onChange={(event) => onIndicators({ ...indicators, volume: { visible: event.target.checked } })}
              />
              <Styles.RowLabel>Volume</Styles.RowLabel>
            </Styles.MenuRow>
            {indicators.volume.visible && (
              <Styles.MenuRow $indented>
                <input
                  type="checkbox"
                  checked={indicators.volumeMa.visible}
                  onChange={(event) =>
                    onIndicators({ ...indicators, volumeMa: { ...indicators.volumeMa, visible: event.target.checked } })
                  }
                />
                <Styles.RowLabel>Volume moving average</Styles.RowLabel>
              </Styles.MenuRow>
            )}
            {indicators.volume.visible && indicators.volumeMa.visible && (
              <Styles.MenuItem $indented>
                <Styles.RowLabel>Length</Styles.RowLabel>
                <NumberField
                  label="Volume average length"
                  value={indicators.volumeMa.length}
                  min={SMA_MIN_LENGTH}
                  max={SMA_MAX_LENGTH}
                  onChange={(length) => onIndicators({ ...indicators, volumeMa: { ...indicators.volumeMa, length } })}
                />
              </Styles.MenuItem>
            )}
            <Styles.MenuRow>
              <input
                type="checkbox"
                checked={indicators.rsi.visible}
                onChange={(event) => setRsi({ visible: event.target.checked })}
              />
              <Styles.RowLabel>RSI</Styles.RowLabel>
            </Styles.MenuRow>
            {indicators.rsi.visible && (
              <>
                <Styles.MenuItem $indented>
                  <Styles.RowLabel>Length</Styles.RowLabel>
                  <NumberField
                    label="Length"
                    value={indicators.rsi.length}
                    min={RSI_MIN_LENGTH}
                    max={RSI_MAX_LENGTH}
                    onChange={(length) => setRsi({ length })}
                  />
                </Styles.MenuItem>
                <Styles.MenuRow $indented>
                  <input
                    type="checkbox"
                    checked={indicators.rsi.showMa}
                    onChange={(event) => setRsi({ showMa: event.target.checked })}
                  />
                  <Styles.RowLabel>RSI moving average</Styles.RowLabel>
                </Styles.MenuRow>
              </>
            )}
            <Styles.MenuSection>Moving averages</Styles.MenuSection>
            {indicators.sma.map((item, index) => (
              <Styles.SmaBlock key={item.id}>
              <Styles.MenuItem>
                <Styles.ColorDot
                  type="button"
                  title="Color and width"
                  aria-label={`Style of average ${index + 1}`}
                  aria-expanded={styleOpenId === item.id}
                  $color={item.color}
                  onClick={() => setStyleOpenId((current) => (current === item.id ? null : item.id))}
                />
                <Styles.TypeButton
                  type="button"
                  title="Simple or exponential"
                  aria-label={`Type of average ${index + 1}`}
                  onClick={() => setSma(indicators.sma.map((other) => (other.id === item.id ? toggleKind(other) : other)))}
                >
                  {item.kind === 'ema' ? 'EMA' : 'SMA'}
                </Styles.TypeButton>
                <NumberField
                  label={`Length of average ${index + 1}`}
                  value={item.length}
                  min={SMA_MIN_LENGTH}
                  max={SMA_MAX_LENGTH}
                  onChange={(length) => patchSma(item.id, { length })}
                />
                <Styles.SmallButton
                  type="button"
                  title="Remove"
                  aria-label={`Remove average ${index + 1}`}
                  onClick={() => setSma(indicators.sma.filter((other) => other.id !== item.id))}
                >
                  ×
                </Styles.SmallButton>
              </Styles.MenuItem>
              {styleOpenId === item.id && (
                <Styles.StylePanel>
                  <Styles.Swatches>
                    {SMA_COLORS.map((color) => (
                      <Styles.Swatch
                        key={color}
                        type="button"
                        aria-label={`Color ${color} of average ${index + 1}`}
                        aria-pressed={item.color.toUpperCase() === color}
                        $color={color}
                        onClick={() => patchSma(item.id, { color })}
                      />
                    ))}
                    <Styles.ColorInput
                      type="color"
                      title="Other color"
                      aria-label={`Other color for average ${index + 1}`}
                      value={item.color}
                      onChange={(event) => patchSma(item.id, { color: event.target.value.toUpperCase() })}
                    />
                  </Styles.Swatches>
                  <Styles.Widths>
                    {SMA_WIDTHS.map((width) => (
                      <Styles.WidthButton
                        key={width}
                        type="button"
                        aria-label={`Width ${width} of average ${index + 1}`}
                        aria-pressed={item.width === width}
                        onClick={() => patchSma(item.id, { width })}
                      >
                        <Styles.WidthSample $width={width} />
                      </Styles.WidthButton>
                    ))}
                  </Styles.Widths>
                </Styles.StylePanel>
              )}
              </Styles.SmaBlock>
            ))}
            <Styles.AddButton type="button" disabled={indicators.sma.length >= MAX_SMAS} onClick={handleAddSma}>
              Add moving average
            </Styles.AddButton>
            <StudiesPanel indicators={indicators} onIndicators={onIndicators} />
          </Styles.Menu>
        )}
      </Styles.MenuAnchor>
      <Styles.MenuAnchor>
        <Styles.Button type="button" aria-expanded={openMenu === 'chart'} onClick={() => toggleMenu('chart')}>
          Chart
        </Styles.Button>
        {openMenu === 'chart' && (
          <Styles.Menu>
            <Styles.MenuSection $first>Type</Styles.MenuSection>
            {CHART_TYPES.map(([type, label]) => (
              <Styles.MenuRow key={type}>
                <input type="radio" name="chart-type" checked={chart.type === type} onChange={() => onChart({ ...chart, type })} />
                <Styles.RowLabel>{label}</Styles.RowLabel>
              </Styles.MenuRow>
            ))}
            <Styles.MenuSection>Price scale</Styles.MenuSection>
            {SCALE_MODES.map(([scale, label]) => (
              <Styles.MenuRow key={scale}>
                <input type="radio" name="chart-scale" checked={chart.scale === scale} onChange={() => onChart({ ...chart, scale })} />
                <Styles.RowLabel>{label}</Styles.RowLabel>
              </Styles.MenuRow>
            ))}
            <Styles.MenuRow>
              <input type="checkbox" checked={chart.invert} onChange={(event) => onChart({ ...chart, invert: event.target.checked })} />
              <Styles.RowLabel>Invert scale</Styles.RowLabel>
            </Styles.MenuRow>
            <Styles.MenuSection>Cursor</Styles.MenuSection>
            {CURSOR_MODES.map(([cursor, label]) => (
              <Styles.MenuRow key={cursor}>
                <input type="radio" name="chart-cursor" checked={chart.cursor === cursor} onChange={() => onChart({ ...chart, cursor })} />
                <Styles.RowLabel>{label}</Styles.RowLabel>
              </Styles.MenuRow>
            ))}
          </Styles.Menu>
        )}
      </Styles.MenuAnchor>
      <Styles.MenuAnchor>
        <Styles.Button type="button" aria-expanded={openMenu === 'config'} onClick={() => toggleMenu('config')}>
          Settings
        </Styles.Button>
        {openMenu === 'config' && (
          <Styles.Menu>
            <ConfigPanel onExport={onExportConfig} onImport={onImportConfig} />
            <TelegramPanel />
          </Styles.Menu>
        )}
      </Styles.MenuAnchor>
      </Styles.Menus>
      <Styles.Spacer />
      {notice && <Styles.Warning role="status">{notice}</Styles.Warning>}
      {onOpenCalendar && (
        <Styles.Button type="button" title="Earnings calendar" aria-label="Earnings calendar" onClick={onOpenCalendar}>
          <CalendarIcon />
        </Styles.Button>
      )}
      <Styles.Button type="button" title="Save image" aria-label="Save image" onClick={onScreenshot}>
        <CameraIcon />
      </Styles.Button>
      <Styles.MenuAnchor ref={themeRef}>
        <Styles.Button
          ref={themeButtonRef}
          type="button"
          title="Theme"
          aria-label="Theme"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'theme'}
          onClick={() => toggleMenu('theme')}
        >
          <PaletteIcon />
        </Styles.Button>
        {openMenu === 'theme' && (
          <Styles.Menu $right role="menu" aria-label="Theme" onKeyDown={handleThemeKey}>
            {THEME_OPTIONS.map((option, index) => (
              <Styles.ThemeOption
                key={option.name}
                ref={(node: HTMLButtonElement | null) => {
                  themeOptionsRef.current[index] = node
                }}
                type="button"
                role="menuitemradio"
                aria-checked={option.name === theme}
                onClick={() => pickTheme(option.name)}
              >
                <Styles.ThemeSwatch
                  aria-hidden="true"
                  $panel={themes[option.name].ui.panel}
                  $chart={themes[option.name].chart.bg}
                  $accent={themes[option.name].ui.accent}
                />
                {option.label}
              </Styles.ThemeOption>
            ))}
          </Styles.Menu>
        )}
      </Styles.MenuAnchor>
    </Styles.Bar>
  )
}
