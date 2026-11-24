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
  }
  renderWithTheme(
    <TopBar
      symbol="AAPL"
      timeframe="D"
      theme="dark"
      indicators={indicators}
      chart={DEFAULT_STATE.chart}
      notice={null}
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
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  expect(screen.getByRole('checkbox', { name: 'RSI' })).toBeTruthy()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('checkbox', { name: 'RSI' })).toBeNull()
})

test('Should toggle indicators from the menu', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  await user.click(screen.getByRole('checkbox', { name: 'RSI' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith({
    volume: { visible: true },
    rsi: { visible: false, length: 14, showMa: true },
    sma: [],
  })
  await user.click(screen.getByRole('checkbox', { name: 'Volumen' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith({
    volume: { visible: false },
    rsi: { visible: true, length: 14, showMa: true },
    sma: [],
  })
})

test('Should clamp the RSI length between 2 and 100', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  const input = screen.getByRole('spinbutton', { name: 'Periodo' })
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
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  await user.clear(screen.getByRole('spinbutton', { name: 'Periodo' }))
  expect(handlers.onIndicators).not.toHaveBeenCalled()
})

test('Should toggle the RSI moving average', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  await user.click(screen.getByRole('checkbox', { name: 'Media del RSI' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ rsi: { visible: true, length: 14, showMa: false } }),
  )
})

test('Should hide the RSI settings while the RSI is off', async () => {
  const { user } = setup({ volume: { visible: true }, rsi: { visible: false, length: 14, showMa: true }, sma: [] })
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  expect(screen.queryByRole('spinbutton', { name: 'Periodo' })).toBeNull()
  expect(screen.queryByRole('checkbox', { name: 'Media del RSI' })).toBeNull()
})

const withSma = (count: number): Indicators => ({
  ...DEFAULT_STATE.indicators,
  sma: Array.from({ length: count }, (_, index) => ({ id: `s${index}`, length: 20 + index, color: SMA_COLORS[index % SMA_COLORS.length], width: 1 })),
})

test('Should add a moving average from the menu', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  await user.click(screen.getByRole('button', { name: 'Añadir media móvil' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith({
    ...DEFAULT_STATE.indicators,
    sma: [{ id: expect.any(String), length: 20, color: SMA_COLORS[0], width: 1 }],
  })
})

test('Should change the period of a moving average', async () => {
  const { handlers, user } = setup(withSma(2))
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  const input = screen.getByRole('spinbutton', { name: 'Periodo de la media 2' })
  await user.clear(input)
  await user.type(input, '100')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [withSma(2).sma[0], { ...withSma(2).sma[1], length: 100 }] }),
  )
})

test('Should clamp the period of a moving average between 1 and 500', async () => {
  const { handlers, user } = setup(withSma(1))
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  const input = screen.getByRole('spinbutton', { name: 'Periodo de la media 1' })
  await user.clear(input)
  await user.type(input, '999')
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [{ ...withSma(1).sma[0], length: 500 }] }),
  )
})

test('Should remove a moving average', async () => {
  const { handlers, user } = setup(withSma(2))
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  await user.click(screen.getByRole('button', { name: 'Quitar media 1' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ sma: [withSma(2).sma[1]] }))
})

const openStyle = async (user: ReturnType<typeof userEvent.setup>, index: number) => {
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  await user.click(screen.getByRole('button', { name: `Estilo de la media ${index}` }))
}

test('Should keep the style options of a moving average closed until asked', async () => {
  const { user } = setup(withSma(1))
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  expect(screen.queryByRole('button', { name: 'Grosor 3 de la media 1' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Estilo de la media 1' }))
  expect(screen.getByRole('button', { name: 'Grosor 3 de la media 1' })).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /^Color #[0-9A-F]{6} de la media 1$/ }).length).toBeGreaterThanOrEqual(16)
})

test('Should mark the current colour and width of a moving average', async () => {
  const { user } = setup(withSma(1))
  await openStyle(user, 1)
  expect(screen.getByRole('button', { name: `Color ${SMA_COLORS[0]} de la media 1` }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: `Color ${SMA_COLORS[5]} de la media 1` }).getAttribute('aria-pressed')).toBe('false')
  expect(screen.getByRole('button', { name: 'Grosor 1 de la media 1' }).getAttribute('aria-pressed')).toBe('true')
})

test('Should change the colour of a moving average from the palette', async () => {
  const { handlers, user } = setup(withSma(2))
  await openStyle(user, 2)
  await user.click(screen.getByRole('button', { name: `Color ${SMA_COLORS[9]} de la media 2` }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [withSma(2).sma[0], { ...withSma(2).sma[1], color: SMA_COLORS[9] }] }),
  )
})

test('Should accept any colour for a moving average', async () => {
  const { handlers, user } = setup(withSma(1))
  await openStyle(user, 1)
  fireEvent.change(screen.getByLabelText('Otro color para la media 1'), { target: { value: '#12ab9f' } })
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [{ ...withSma(1).sma[0], color: '#12AB9F' }] }),
  )
})

test('Should change the width of a moving average', async () => {
  const { handlers, user } = setup(withSma(1))
  await openStyle(user, 1)
  await user.click(screen.getByRole('button', { name: 'Grosor 3 de la media 1' }))
  expect(handlers.onIndicators).toHaveBeenLastCalledWith(
    expect.objectContaining({ sma: [{ ...withSma(1).sma[0], width: 3 }] }),
  )
})

test('Should not offer more than six moving averages', async () => {
  const { handlers, user } = setup(withSma(6))
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  const add = screen.getByRole('button', { name: 'Añadir media móvil' })
  expect(add.hasAttribute('disabled')).toBe(true)
  await user.click(add)
  expect(handlers.onIndicators).not.toHaveBeenCalled()
})

const openChartMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Gráfico' }))

const checked = (name: string): boolean => (screen.getByRole('radio', { name }) as HTMLInputElement).checked

test('Should offer every chart type the engine has and mark the current one', async () => {
  const { user } = setup()
  await openChartMenu(user)
  expect(['Velas', 'Barras', 'Línea', 'Área', 'Línea base'].map(checked)).toEqual([true, false, false, false, false])
})

test('Should report the chosen chart type', async () => {
  const { handlers, user } = setup()
  await openChartMenu(user)
  await user.click(screen.getByRole('radio', { name: 'Área' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, type: 'area' })
})

test('Should offer every price scale and report the chosen one', async () => {
  const { handlers, user } = setup()
  await openChartMenu(user)
  expect(['Normal', 'Logarítmica', 'Porcentaje', 'Indexada a 100'].map(checked)).toEqual([true, false, false, false])
  await user.click(screen.getByRole('radio', { name: 'Logarítmica' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, scale: 'log' })
})

test('Should invert the price scale', async () => {
  const { handlers, user } = setup()
  await openChartMenu(user)
  await user.click(screen.getByRole('checkbox', { name: 'Invertir escala' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, invert: true })
})

test('Should offer every cursor mode and report the chosen one', async () => {
  const { handlers, user } = setup()
  await openChartMenu(user)
  expect(['Libre', 'Imán al cierre', 'Imán a OHLC'].map(checked)).toEqual([true, false, false])
  await user.click(screen.getByRole('radio', { name: 'Imán a OHLC' }))
  expect(handlers.onChart).toHaveBeenLastCalledWith({ ...DEFAULT_STATE.chart, cursor: 'magnetOhlc' })
})

test('Should show one menu at a time', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Indicadores' }))
  await openChartMenu(user)
  expect(screen.queryByRole('checkbox', { name: 'RSI' })).toBeNull()
  expect(screen.getByRole('radio', { name: 'Velas' })).toBeTruthy()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('radio', { name: 'Velas' })).toBeNull()
})

test('Should ask for an image of the chart', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Guardar imagen' }))
  expect(handlers.onScreenshot).toHaveBeenCalledTimes(1)
})

test('Should ask for the opposite theme', async () => {
  const { handlers, user } = setup()
  await user.click(screen.getByRole('button', { name: 'Cambiar a tema claro' }))
  expect(handlers.onTheme).toHaveBeenCalledWith('light')
})

test('Should show a notice about saving when there is one', () => {
  const noop = () => undefined
  renderWithTheme(
    <TopBar
      symbol="AAPL"
      timeframe="D"
      theme="light"
      indicators={DEFAULT_STATE.indicators}
      notice="No se pudieron guardar los cambios"
      onOpenSearch={noop}
      onTimeframe={noop}
      onTheme={noop}
      onIndicators={noop}
      chart={DEFAULT_STATE.chart}
      onChart={noop}
      onScreenshot={noop}
    />,
  )
  expect(screen.getByRole('status').textContent).toBe('No se pudieron guardar los cambios')
  expect(screen.getByRole('button', { name: 'Cambiar a tema oscuro' })).toBeTruthy()
})
