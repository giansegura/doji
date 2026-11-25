import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { DEFAULT_STATE, type Indicators } from '../../../shared/types'
import { SMA_COLORS } from '../../../shared/limits'
import { renderWithTheme } from '../../test/render'
import { TopBar } from '.'

const setup = (indicators: Indicators = DEFAULT_STATE.indicators) => {
  const handlers = {
    onOpenSearch: vi.fn(),
    onTimeframe: vi.fn(),
    onTheme: vi.fn(),
    onIndicators: vi.fn(),
    onChart: vi.fn(),
    onScreenshot: vi.fn(),
    onOpenCalendar: vi.fn(),
    onReplay: vi.fn(),
    onExportConfig: vi.fn(),
    onImportConfig: vi.fn(),
    onSplit: vi.fn(),
    onShareHoldings: vi.fn(),
  }
  renderWithTheme(
    <TopBar
      symbol="AAPL"
      timeframe="D"
      theme="midnight"
      indicators={indicators}
      chart={DEFAULT_STATE.chart}
      notice={null}
      split={false}
      shareHoldings={false}
      alerts={<div>Panel de alertas</div>}
      armedAlerts={2}
      {...handlers}
    />,
  )
  return { handlers, user: userEvent.setup() }
}

test('Should open the symbol search from the symbol button', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'AAPL' }))
  expect(handlers.onOpenSearch).toHaveBeenCalledTimes(1)
})

test('Should mark the active timeframe and report a change', async () => {
  const { handlers, user } = setup()
  expect(screen.getByRole('button', { name: 'D' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'W' }).getAttribute('aria-pressed')).toBe('false')
  await user.click(screen.getByRole('button', { name: 'W' }))
  expect(handlers.onTimeframe).toHaveBeenCalledWith('W')
})

test('Should keep the indicators menu closed until asked', async () => {
  const { user } = setup()
  expect(screen.queryByRole('checkbox', { name: 'RSI' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  expect(screen.getByRole('checkbox', { name: 'RSI' })).toBeTruthy()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('checkbox', { name: 'RSI' })).toBeNull()
})

test('Should toggle indicators from the menu', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  await user.click(screen.getByRole('checkbox', { name: 'RSI' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith({
    ...DEFAULT_STATE.indicators,
    rsi: { visible: false, length: 14, showMa: true },
  })
  await user.click(screen.getByRole('checkbox', { name: 'Volume' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith({
    ...DEFAULT_STATE.indicators,
    volume: { visible: false },
  })
})

test('Should clamp the RSI length between 2 and 100', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  const input = screen.getByRole('spinbutton', { name: 'Length' })
  await user.clear(input)
  await user.type(input, '500')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ rsi: { visible: true, length: 100, showMa: true } }),
  )
  await user.clear(input)
  await user.type(input, '1')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ rsi: { visible: true, length: 2, showMa: true } }),
  )
})

test('Should not report a length while the field is empty', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  await user.clear(screen.getByRole('spinbutton', { name: 'Length' }))
  expect(handlers.onIndicators).not.toHaveBeenCalled()
})

test('Should toggle the RSI moving average', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  await user.click(screen.getByRole('checkbox', { name: 'RSI moving average' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ rsi: { visible: true, length: 14, showMa: false } }),
  )
})

test('Should hide the RSI settings while the RSI is off', async () => {
  const { user } = setup({ ...DEFAULT_STATE.indicators, rsi: { visible: false, length: 14, showMa: true } })
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  expect(screen.queryByRole('spinbutton', { name: 'Length' })).toBeNull()
  expect(screen.queryByRole('checkbox', { name: 'RSI moving average' })).toBeNull()
})

const withSma = (count: number): Indicators => ({
  ...DEFAULT_STATE.indicators,
  sma: Array.from({ length: count }, (_, index) => ({ id: `s${index}`, length: 20 + index, color: SMA_COLORS[index % SMA_COLORS.length], width: 1 })),
})

test('Should add a moving average from the menu', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  await user.click(screen.getByRole('button', { name: 'Add moving average' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith({
    ...DEFAULT_STATE.indicators,
    sma: [{ id: expect.any(String), length: 20, color: SMA_COLORS[0], width: 1 }],
  })
})

test('Should change the period of a moving average', async () => {
  const { handlers, user } = setup(withSma(2))
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  const input = screen.getByRole('spinbutton', { name: 'Length of average 2' })
  await user.clear(input)
  await user.type(input, '100')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [withSma(2).sma[0], { ...withSma(2).sma[1], length: 100 }] }),
  )
})

test('Should clamp the period of a moving average between 1 and 500', async () => {
  const { handlers, user } = setup(withSma(1))
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  const input = screen.getByRole('spinbutton', { name: 'Length of average 1' })
  await user.clear(input)
  await user.type(input, '999')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [{ ...withSma(1).sma[0], length: 500 }] }),
  )
})

test('Should remove a moving average', async () => {
  const { handlers, user } = setup(withSma(2))
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  await user.click(screen.getByRole('button', { name: 'Remove average 1' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ sma: [withSma(2).sma[1]] }))
})

const openStyle = async (user: ReturnType<typeof userEvent.setup>, index: number) => {
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  await user.click(screen.getByRole('button', { name: `Style of average ${index}` }))
}

test('Should keep the style options of a moving average closed until asked', async () => {
  const { user } = setup(withSma(1))
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  expect(screen.queryByRole('button', { name: 'Width 3 of average 1' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Style of average 1' }))
  expect(screen.getByRole('button', { name: 'Width 3 of average 1' })).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /^Color #[0-9A-F]{6} of average 1$/ }).length).toBeGreaterThanOrEqual(16)
})

test('Should mark the current colour and width of a moving average', async () => {
  const { user } = setup(withSma(1))
  await openStyle(user, 1)
  expect(screen.getByRole('button', { name: `Color ${SMA_COLORS[0]} of average 1` }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: `Color ${SMA_COLORS[5]} of average 1` }).getAttribute('aria-pressed')).toBe('false')
  expect(screen.getByRole('button', { name: 'Width 1 of average 1' }).getAttribute('aria-pressed')).toBe('true')
})

test('Should change the colour of a moving average from the palette', async () => {
  const { handlers, user } = setup(withSma(2))
  await openStyle(user, 2)
  await user.click(screen.getByRole('button', { name: `Color ${SMA_COLORS[9]} of average 2` }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [withSma(2).sma[0], { ...withSma(2).sma[1], color: SMA_COLORS[9] }] }),
  )
})

test('Should accept any colour for a moving average', async () => {
  const { handlers, user } = setup(withSma(1))
  await openStyle(user, 1)
  fireEvent.change(screen.getByLabelText('Other color for average 1'), { target: { value: '#12ab9f' } })
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [{ ...withSma(1).sma[0], color: '#12AB9F' }] }),
  )
})

test('Should change the width of a moving average', async () => {
  const { handlers, user } = setup(withSma(1))
  await openStyle(user, 1)
  await user.click(screen.getByRole('button', { name: 'Width 3 of average 1' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [{ ...withSma(1).sma[0], width: 3 }] }),
  )
})

test('Should not offer more than six moving averages', async () => {
  const { handlers, user } = setup(withSma(6))
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  const add = screen.getByRole('button', { name: 'Add moving average' })
  expect(add.hasAttribute('disabled')).toBe(true)
  await user.click(add)
  expect(handlers.onIndicators).not.toHaveBeenCalled()
})

const openChartMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Chart' }))

const checked = (name: string): boolean => (screen.getByRole('radio', { name }) as HTMLInputElement).checked

test('Should offer every chart type the engine has and mark the current one', async () => {
  const { user } = setup()
  await openChartMenu(user)
  expect(['Candles', 'Bars', 'Line', 'Area', 'Baseline'].map(checked)).toEqual([true, false, false, false, false])
})

test('Should report the chosen chart type', async () => {
  const { handlers, user } = setup()
  await openChartMenu(user)
  await user.click(screen.getByRole('radio', { name: 'Area' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, type: 'area' })
})

test('Should offer every price scale and report the chosen one', async () => {
  const { handlers, user } = setup()
  await openChartMenu(user)
  expect(['Normal', 'Logarithmic', 'Percent', 'Indexed to 100'].map(checked)).toEqual([true, false, false, false])
  await user.click(screen.getByRole('radio', { name: 'Logarithmic' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, scale: 'log' })
})

test('Should invert the price scale', async () => {
  const { handlers, user } = setup()
  await openChartMenu(user)
  await user.click(screen.getByRole('checkbox', { name: 'Invert scale' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, invert: true })
})

test('Should offer every cursor mode and report the chosen one', async () => {
  const { handlers, user } = setup()
  await openChartMenu(user)
  expect(['Free', 'Magnet to close', 'Magnet to OHLC'].map(checked)).toEqual([true, false, false])
  await user.click(screen.getByRole('radio', { name: 'Magnet to OHLC' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, cursor: 'magnetOhlc' })
})

test('Should show one menu at a time', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicators' }))
  await openChartMenu(user)
  expect(screen.queryByRole('checkbox', { name: 'RSI' })).toBeNull()
  expect(screen.getByRole('radio', { name: 'Candles' })).toBeTruthy()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('radio', { name: 'Candles' })).toBeNull()
})

test('Should ask for an image of the chart', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Save image' }))
  expect(handlers.onScreenshot).toHaveBeenCalledTimes(1)
})

test('Should list the themes with the current one checked', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Theme' }))
  const options = screen.getAllByRole('menuitemradio')
  expect(options.map((option) => [option.textContent, option.getAttribute('aria-checked')])).toEqual([
    ['Doji', 'false'],
    ['Midnight', 'true'],
    ['Light', 'false'],
  ])
})

test('Should ask for the theme picked and close the list', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Theme' }))
  await user.click(screen.getByRole('menuitemradio', { name: 'Doji' }))
  expect(handlers.onTheme).toHaveBeenCalledWith('doji')
  expect(screen.queryByRole('menuitemradio')).toBeNull()
})

test('Should show the doji mark at the start of the bar', () => {
  setup()
  const bar = screen.getByRole('img', { name: 'doji' }).closest('header')
  expect(bar?.firstElementChild?.getAttribute('aria-label')).toBe('doji')
})

test('Should show a notice about saving when there is one', () => {
  const noop = () => undefined
  renderWithTheme(
    <TopBar
      symbol="AAPL"
      timeframe="D"
      theme="light"
      indicators={DEFAULT_STATE.indicators}
      notice="Could not save your changes"
      onOpenSearch={noop}
      onTimeframe={noop}
      onTheme={noop}
      onIndicators={noop}
      chart={DEFAULT_STATE.chart}
      onChart={noop}
      onScreenshot={noop}
      onExportConfig={noop}
      onImportConfig={noop}
      split
      onSplit={noop}
    />,
  )
  expect(screen.getByRole('status').textContent).toBe('Could not save your changes')
  expect(screen.getByRole('button', { name: 'Theme' })).toBeTruthy()
})

const configFile = (content: unknown, name = 'mi-config.json'): File =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' })

const openConfigMenu = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Settings' }))

test('Should keep the configuration menu closed until asked', async () => {
  const { user } = setup()
  expect(screen.queryByRole('button', { name: 'Export settings' })).toBeNull()
  await openConfigMenu(user)
  expect(screen.getByRole('button', { name: 'Export settings' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Import settings…' })).toBeTruthy()
})

test('Should keep the positions away from the AI until the user shares them', async () => {
  const { handlers, user } = setup()
  await openConfigMenu(user)
  const share = screen.getByRole('checkbox', { name: 'Share positions with the AI' }) as HTMLInputElement
  expect(share.checked).toBe(false)
  await user.click(share)
  expect(handlers.onShareHoldings).toHaveBeenCalledWith(true)
})

test('Should ask for the configuration to be exported', async () => {
  const { handlers, user } = setup()
  await openConfigMenu(user)
  await user.click(screen.getByRole('button', { name: 'Export settings' }))
  expect(handlers.onExportConfig).toHaveBeenCalledTimes(1)
})

test('Should ask before replacing the configuration with the one in a file', async () => {
  const { handlers, user } = setup()
  const imported = { ...DEFAULT_STATE, theme: 'light', symbol: 'KO' }
  await openConfigMenu(user)
  await user.upload(screen.getByLabelText('Settings file'), configFile(imported))
  expect(await screen.findByText(/“mi-config\.json”/)).toBeTruthy()
  expect(handlers.onImportConfig).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Replace' }))
  expect(handlers.onImportConfig).toHaveBeenCalledTimes(1)
  expect(handlers.onImportConfig).toHaveBeenCalledWith(imported)
  expect(screen.getByRole('status').textContent).toBe('Settings imported.')
  expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull()
})

test('Should leave the configuration alone when the import is cancelled', async () => {
  const { handlers, user } = setup()
  await openConfigMenu(user)
  await user.upload(screen.getByLabelText('Settings file'), configFile(DEFAULT_STATE))
  await user.click(await screen.findByRole('button', { name: 'Cancel' }))
  expect(handlers.onImportConfig).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull()
})

test('Should refuse a file that is not a configuration', async () => {
  const { handlers, user } = setup()
  await openConfigMenu(user)
  await user.upload(screen.getByLabelText('Settings file'), configFile('hola'))
  expect((await screen.findByRole('alert')).textContent).toBe('That file is not a doji settings file.')
  expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull()
  expect(handlers.onImportConfig).not.toHaveBeenCalled()
})

test('Should accept the same file again after refusing or cancelling it', async () => {
  const { handlers, user } = setup()
  const file = configFile(DEFAULT_STATE)
  await openConfigMenu(user)
  await user.upload(screen.getByLabelText('Settings file'), file)
  await user.click(await screen.findByRole('button', { name: 'Cancel' }))
  await user.upload(screen.getByLabelText('Settings file'), file)
  await user.click(await screen.findByRole('button', { name: 'Replace' }))
  expect(handlers.onImportConfig).toHaveBeenCalledTimes(1)
})

test('Should offer the monthly timeframe', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'M' }))
  expect(handlers.onTimeframe).toHaveBeenCalledWith('M')
})

const openIndicators = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Indicators' }))

const typeInto = async (user: ReturnType<typeof userEvent.setup>, name: string, value: string) => {
  const input = screen.getByRole('spinbutton', { name })
  await user.clear(input)
  await user.type(input, value)
}

test('Should switch the average of the volume on and set its length', async () => {
  const { handlers, user } = setup()
  await openIndicators(user)
  expect(screen.queryByRole('spinbutton', { name: 'Volume average length' })).toBeNull()
  await user.click(screen.getByRole('checkbox', { name: 'Volume moving average' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ volumeMa: { visible: true, length: 20 } }),
  )
})

test('Should set the length of the average of the volume while it is on', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, volumeMa: { visible: true, length: 20 } })
  await openIndicators(user)
  await typeInto(user, 'Volume average length', '50')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ volumeMa: { visible: true, length: 50 } }),
  )
})

test('Should switch a moving average between simple and exponential', async () => {
  const sma = [{ id: 'a', length: 20, color: '#FF9800', width: 1 }]
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, sma })
  await openIndicators(user)
  const toggle = screen.getByRole('button', { name: 'Type of average 1' })
  expect(toggle.textContent).toBe('SMA')
  await user.click(toggle)
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ sma: [{ ...sma[0], kind: 'ema' }] }))
})

test('Should switch an exponential moving average back to simple', async () => {
  const sma = [{ id: 'a', length: 20, color: '#FF9800', width: 1, kind: 'ema' as const }]
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, sma })
  await openIndicators(user)
  const toggle = screen.getByRole('button', { name: 'Type of average 1' })
  expect(toggle.textContent).toBe('EMA')
  await user.click(toggle)
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [{ id: 'a', length: 20, color: '#FF9800', width: 1 }] }),
  )
})

test('Should switch the Bollinger Bands on and keep their settings hidden until then', async () => {
  const { handlers, user } = setup()
  await openIndicators(user)
  expect(screen.queryByRole('spinbutton', { name: 'Bollinger length' })).toBeNull()
  await user.click(screen.getByRole('checkbox', { name: 'Bollinger Bands' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ bollinger: { visible: true, length: 20, multiplier: 2 } }),
  )
})

test('Should set the length and the multiplier of the Bollinger Bands', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, bollinger: { visible: true, length: 20, multiplier: 2 } })
  await openIndicators(user)
  await typeInto(user, 'Bollinger length', '30')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ bollinger: { visible: true, length: 30, multiplier: 2 } }),
  )
  await typeInto(user, 'Bollinger multiplier', '3')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ bollinger: { visible: true, length: 20, multiplier: 3 } }),
  )
})

test('Should switch the support and resistance levels on and set how many it shows per side', async () => {
  const { handlers, user } = setup()
  await openIndicators(user)
  expect(screen.queryByRole('spinbutton', { name: 'Levels per side' })).toBeNull()
  await user.click(screen.getByRole('checkbox', { name: 'Support & resistance' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ levels: { visible: true, perSide: 3 } }))
})

test('Should set how many support and resistance levels it shows per side', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, levels: { visible: true, perSide: 3 } })
  await openIndicators(user)
  await typeInto(user, 'Levels per side', '2')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ levels: { visible: true, perSide: 2 } }))
})

test('Should switch the volume profile on and set how many rows it splits the prices into', async () => {
  const { handlers, user } = setup()
  await openIndicators(user)
  expect(screen.queryByRole('spinbutton', { name: 'Volume profile rows' })).toBeNull()
  await user.click(screen.getByRole('checkbox', { name: 'Volume profile' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ volumeProfile: { visible: true, rows: 24 } }))
})

test('Should set the rows of the volume profile', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, volumeProfile: { visible: true, rows: 24 } })
  await openIndicators(user)
  await typeInto(user, 'Volume profile rows', '40')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ volumeProfile: { visible: true, rows: 40 } }))
})

test('Should hide the earnings marks and the dividend marks each on its own', async () => {
  const { handlers, user } = setup()
  await openIndicators(user)
  await user.click(screen.getByRole('checkbox', { name: 'Earnings marks' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ marks: { earnings: false, dividends: true } }))
  await user.click(screen.getByRole('checkbox', { name: 'Dividend marks' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ marks: { earnings: true, dividends: false } }))
})

test('Should switch the MACD on and set its three lengths', async () => {
  const { handlers, user } = setup()
  await openIndicators(user)
  expect(screen.queryByRole('spinbutton', { name: 'MACD fast length' })).toBeNull()
  await user.click(screen.getByRole('checkbox', { name: 'MACD' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ macd: { visible: true, fast: 12, slow: 26, signal: 9 } }),
  )
})

test('Should set each length of the MACD on its own', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, macd: { visible: true, fast: 12, slow: 26, signal: 9 } })
  await openIndicators(user)
  await typeInto(user, 'MACD fast length', '8')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ macd: { visible: true, fast: 8, slow: 26, signal: 9 } }),
  )
  await typeInto(user, 'MACD signal length', '5')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ macd: { visible: true, fast: 12, slow: 26, signal: 5 } }),
  )
})

test('Should ask for a second chart and say that there is none yet', async () => {
  const { handlers, user } = setup()
  const toggle = screen.getByRole('button', { name: 'Two charts' })
  expect(toggle.getAttribute('aria-pressed')).toBe('false')
  await user.click(toggle)
  expect(handlers.onSplit).toHaveBeenCalledTimes(1)
})

test('Should accept a Bollinger multiplier with decimals and keep it within its limits', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, bollinger: { visible: true, length: 20, multiplier: 2 } })
  await openIndicators(user)
  await typeInto(user, 'Bollinger multiplier', '1.5')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ bollinger: { visible: true, length: 20, multiplier: 1.5 } }),
  )
  await typeInto(user, 'Bollinger multiplier', '0.1')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ bollinger: { visible: true, length: 20, multiplier: 0.5 } }),
  )
})

test('Should keep the lengths of the indicators whole', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, bollinger: { visible: true, length: 20, multiplier: 2 } })
  await openIndicators(user)
  await typeInto(user, 'Bollinger length', '30.7')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ bollinger: { visible: true, length: 30, multiplier: 2 } }),
  )
})

test('Should show a forex pair like TradingView on the symbol button', () => {
  const noop = () => undefined
  renderWithTheme(
    <TopBar
      symbol="EURUSD=X"
      timeframe="D"
      theme="midnight"
      indicators={DEFAULT_STATE.indicators}
      notice={null}
      onOpenSearch={noop}
      onTimeframe={noop}
      onTheme={noop}
      onIndicators={noop}
      chart={DEFAULT_STATE.chart}
      onChart={noop}
      onScreenshot={noop}
      onExportConfig={noop}
      onImportConfig={noop}
      split={false}
      onSplit={noop}
    />,
  )
  expect(screen.getByRole('button', { name: 'EURUSD' }).textContent).toBe('EURUSD')
})

test('Should move the focus to the current theme when the list opens and through the themes with the arrow keys', async () => {
  const { user } = setup()
  screen.getByRole('button', { name: 'Theme' }).focus()
  await user.keyboard('{Enter}')
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Midnight' }))
  await user.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Light' }))
  await user.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Doji' }))
  await user.keyboard('{ArrowUp}')
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Light' }))
  await user.keyboard('{Home}')
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Doji' }))
  await user.keyboard('{End}')
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Light' }))
})

test('Should give the focus back to the theme button after picking a theme or pressing Escape', async () => {
  const { handlers, user } = setup()
  const trigger = screen.getByRole('button', { name: 'Theme' })
  trigger.focus()
  await user.keyboard('{Enter}{ArrowUp}{Enter}')
  expect(handlers.onTheme).toHaveBeenCalledWith('doji')
  expect(screen.queryByRole('menu', { name: 'Theme' })).toBeNull()
  expect(document.activeElement).toBe(trigger)
  await user.keyboard('{Enter}{Escape}')
  expect(screen.queryByRole('menu', { name: 'Theme' })).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test('Should close the list of themes with Escape or a click elsewhere', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Theme' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu', { name: 'Theme' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Theme' }))
  await user.click(document.body)
  expect(screen.queryByRole('menu', { name: 'Theme' })).toBeNull()
})

test('Should open the earnings calendar from its button', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Earnings calendar' }))
  expect(handlers.onOpenCalendar).toHaveBeenCalledTimes(1)
})

test('Should start a replay from its button and mark it while a replay is on', async () => {
  const { handlers, user } = setup()
  const replay = screen.getByRole('button', { name: 'Replay' })
  expect(replay.getAttribute('aria-pressed')).toBe('false')
  await user.click(replay)
  expect(handlers.onReplay).toHaveBeenCalledTimes(1)
})

test('Should show the chart in euros or in the currency of the symbol from the chart menu', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Chart' }))
  expect((screen.getByRole('radio', { name: 'Symbol currency' }) as HTMLInputElement).checked).toBe(true)
  await user.click(screen.getByRole('radio', { name: 'Euros' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, currency: 'EUR' })
})

test('Should open the alerts of the symbol from the bell, which counts the armed ones', async () => {
  const { user } = setup()
  const bell = screen.getByRole('button', { name: 'Alerts, 2 armed' })
  expect(screen.queryByText('Panel de alertas')).toBeNull()
  await user.click(bell)
  expect(screen.getByText('Panel de alertas')).toBeTruthy()
})

test('Should switch the candle patterns on and choose which ones to mark', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, patterns: { visible: true, kinds: ['doji', 'hammer'] } })
  await openIndicators(user)
  await user.click(screen.getByRole('checkbox', { name: 'Hammer' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ patterns: { visible: true, kinds: ['doji'] } }))
  await user.click(screen.getByRole('checkbox', { name: 'Bullish engulfing' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ patterns: { visible: true, kinds: ['doji', 'hammer', 'bullishEngulfing'] } }))
})

test('Should switch the open gaps on and set their minimum size', async () => {
  const { handlers, user } = setup()
  await openIndicators(user)
  await user.click(screen.getByRole('checkbox', { name: 'Open gaps' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ gaps: { visible: true, minPercent: 1 } }))
})

test('Should set the minimum size of the open gaps', async () => {
  const { handlers, user } = setup({ ...DEFAULT_STATE.indicators, gaps: { visible: true, minPercent: 1 } })
  await openIndicators(user)
  await typeInto(user, 'Minimum gap %', '2')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ gaps: { visible: true, minPercent: 2 } }))
})

test('Should switch the RSI divergences on', async () => {
  const { handlers, user } = setup()
  await openIndicators(user)
  await user.click(screen.getByRole('checkbox', { name: 'RSI divergences' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ divergences: { visible: true } }))
})
