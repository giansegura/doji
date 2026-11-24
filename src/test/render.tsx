import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ThemeProvider } from 'styled-components'
import { themes } from '../theme/tokens'

export const renderWithTheme = (ui: ReactElement) => render(<ThemeProvider theme={themes.dark}>{ui}</ThemeProvider>)
