import { fireEvent, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { expect, test } from 'vitest'
import { renderWithTheme } from '../../test/render'
import { themes } from '../../theme/tokens'
import { SymbolLogo } from '.'

const image = (): HTMLImageElement | null => document.querySelector('img')

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
