import { fireEvent, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { themes } from '../../theme/tokens'
import { SymbolLogo } from '.'

const image = (): HTMLImageElement | null => document.querySelector('img')

const SIDE = 32

const paintedWith = (background: number[], ink: number[] = background) => ({
  drawImage: vi.fn(),
  getImageData: () => ({
    data: Array.from({ length: SIDE * SIDE }, (_, index) => {
      const x = index % SIDE
      const y = Math.floor(index / SIDE)
      return x >= 8 && x < 24 && y >= 8 && y < 24 ? ink : background
    }).flat(),
  }),
})

const canvasGives = (context: ReturnType<typeof paintedWith> | null) =>
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)

beforeEach(() => {
  canvasGives(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('Should ask the server for the logo of the symbol', () => {
  renderWithTheme(<SymbolLogo symbol="BRK-B" />)
  expect(image()?.getAttribute('src')).toBe('/api/logo?symbol=BRK-B')
})

test('Should encode symbols that need it', () => {
  renderWithTheme(<SymbolLogo symbol="^GSPC" />)
  expect(image()?.getAttribute('src')).toBe('/api/logo?symbol=%5EGSPC')
})

test('Should show the initial until the logo arrives', () => {
  renderWithTheme(<SymbolLogo symbol="AAPL" />)
  expect(screen.getByText('A')).toBeTruthy()
  expect(image()?.dataset.loaded).toBe('false')
})

test('Should show the logo once it has loaded', () => {
  renderWithTheme(<SymbolLogo symbol="AAPL" />)
  fireEvent.load(image() as HTMLImageElement)
  expect(image()?.dataset.loaded).toBe('true')
})

test('Should keep the initial when there is no logo', () => {
  renderWithTheme(<SymbolLogo symbol="KO" />)
  fireEvent.error(image() as HTMLImageElement)
  expect(image()).toBe(null)
  expect(screen.getByText('K')).toBeTruthy()
})

test('Should be decorative for screen readers', () => {
  renderWithTheme(<SymbolLogo symbol="AAPL" />)
  expect(image()?.getAttribute('alt')).toBe('')
})

test('Should try again when the symbol changes', () => {
  const { rerender } = renderWithTheme(<SymbolLogo symbol="KO" />)
  fireEvent.error(image() as HTMLImageElement)
  rerender(
    <ThemeProvider theme={themes.dark}>
      <SymbolLogo symbol="AAPL" />
    </ThemeProvider>,
  )
  expect(image()?.getAttribute('src')).toBe('/api/logo?symbol=AAPL')
})

test('Should show the flags of both currencies of a forex pair instead of asking for a logo', () => {
  renderWithTheme(<SymbolLogo symbol="EUR=X" />)
  expect(image()).toBeNull()
  const flags = [...document.querySelectorAll('[data-currency]')].map((flag) => [flag.getAttribute('data-currency'), flag.textContent])
  expect(flags).toEqual([
    ['EUR', '🇪🇺'],
    ['USD', '🇺🇸'],
  ])
})

test('Should show the code of a currency that has no country', () => {
  renderWithTheme(<SymbolLogo symbol="XAUUSD=X" />)
  expect(document.querySelector('[data-currency="XAU"]')?.textContent).toBe('X')
})

test('Should fill the circle with a logo that is a tile of colour', () => {
  canvasGives(paintedWith([26, 30, 33, 255], [255, 255, 255, 255]))
  renderWithTheme(<SymbolLogo symbol="AAPL" />)
  fireEvent.load(image() as HTMLImageElement)
  const style = getComputedStyle(image() as HTMLImageElement)
  expect(image()?.dataset.shape).toBe('tile')
  expect([style.objectFit, style.padding]).toEqual(['cover', '0px'])
})

test('Should keep a loose logo on white with a margin around it', () => {
  canvasGives(paintedWith([0, 0, 0, 0], [220, 0, 1, 255]))
  renderWithTheme(<SymbolLogo symbol="SPY" />)
  fireEvent.load(image() as HTMLImageElement)
  const style = getComputedStyle(image() as HTMLImageElement)
  expect(image()?.dataset.shape).toBe('mark')
  expect([style.objectFit, style.padding, style.backgroundColor]).toEqual(['contain', '16%', 'rgb(255, 255, 255)'])
})

test('Should treat the logo as loose when its pixels cannot be read', () => {
  renderWithTheme(<SymbolLogo symbol="AAPL" />)
  fireEvent.load(image() as HTMLImageElement)
  expect(image()?.dataset.shape).toBe('mark')
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    throw new Error('tainted')
  })
  fireEvent.load(image() as HTMLImageElement)
  expect(image()?.dataset.shape).toBe('mark')
})

test('Should read the shape of each logo again when the symbol changes', () => {
  canvasGives(paintedWith([26, 30, 33, 255], [255, 255, 255, 255]))
  const { rerender } = renderWithTheme(<SymbolLogo symbol="AAPL" />)
  fireEvent.load(image() as HTMLImageElement)
  canvasGives(paintedWith([0, 0, 0, 0], [220, 0, 1, 255]))
  rerender(
    <ThemeProvider theme={themes.dark}>
      <SymbolLogo symbol="SPY" />
    </ThemeProvider>,
  )
  expect(image()?.dataset.loaded).toBe('false')
  fireEvent.load(image() as HTMLImageElement)
  expect(image()?.dataset.shape).toBe('mark')
})

test('Should put a white logo on a dark circle so it can be seen', () => {
  canvasGives(paintedWith([0, 0, 0, 0], [255, 255, 255, 255]))
  renderWithTheme(<SymbolLogo symbol="QQQ" />)
  fireEvent.load(image() as HTMLImageElement)
  const style = getComputedStyle(image() as HTMLImageElement)
  expect(image()?.dataset.shape).toBe('pale')
  expect([style.objectFit, style.padding, style.backgroundColor]).toEqual(['contain', '16%', 'rgb(30, 34, 45)'])
})
