import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import * as LeftToolbarStyles from './components/LeftToolbar/styles'
import * as NotesStyles from './components/NotesPanel/styles'
import * as SearchStyles from './components/SymbolSearch/styles'
import * as TopBarStyles from './components/TopBar/styles'
import * as Styles from './styles'
import { renderWithTheme } from './test/render'

const styleOf = (testId: string) => getComputedStyle(screen.getByTestId(testId))

test('Should separate the areas with four-pixel bands of the grey of TradingView', () => {
  renderWithTheme(<Styles.Layout $listWidth={400} data-testid="layout" />)
  expect(styleOf('layout').getPropertyValue('gap')).toBe('4px')
  expect(styleOf('layout').backgroundColor).toBe('rgb(34, 34, 34)')
})

test('Should leave a thin row under the top bar for the market ticker only while it is shown', () => {
  renderWithTheme(
    <>
      <Styles.Layout $listWidth={400} $ticker data-testid="with" />
      <Styles.Layout $listWidth={400} $ticker={false} data-testid="without" />
    </>,
  )
  expect(styleOf('with').getPropertyValue('grid-template-rows')).toBe('38px 26px minmax(0, 1fr)')
  expect(styleOf('with').getPropertyValue('grid-template-areas')).toContain('ticker ticker ticker')
  expect(styleOf('without').getPropertyValue('grid-template-rows')).toBe('38px minmax(0, 1fr)')
  expect(styleOf('without').getPropertyValue('grid-template-areas')).not.toContain('ticker')
})

test('Should paint everything around the chart black, like TradingView', () => {
  renderWithTheme(
    <>
      <TopBarStyles.Bar data-testid="top" />
      <LeftToolbarStyles.Bar data-testid="tools" />
      <Styles.List data-testid="list" />
    </>,
  )
  for (const area of ['top', 'tools', 'list']) {
    expect(styleOf(area).backgroundColor).toBe('rgb(0, 0, 0)')
    expect([styleOf(area).borderBottomStyle, styleOf(area).borderRightStyle, styleOf(area).borderLeftStyle]).toEqual(['none', 'none', 'none'])
  }
})

test('Should separate the notes from the watchlist with the same band', () => {
  renderWithTheme(<NotesStyles.Panel data-testid="notes" />)
  expect(styleOf('notes').borderTopWidth).toBe('4px')
  expect(styleOf('notes').borderTopColor).toBe('rgb(34, 34, 34)')
})

test('Should keep dialogs and menus on their own surface so they stand out from the black areas', () => {
  renderWithTheme(<SearchStyles.Dialog data-testid="dialog" />)
  expect(styleOf('dialog').backgroundColor).toBe('rgb(30, 34, 45)')
})
