import { createGlobalStyle } from 'styled-components'

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, #root {
    height: 100%;
    margin: 0;
  }

  body {
    background: ${(props) => props.theme.ui.bg};
    color: ${(props) => props.theme.ui.text};
    font-family: ${(props) => props.theme.ui.font};
    font-size: 13px;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  button, input {
    font: inherit;
    color: inherit;
  }

  button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  :focus-visible {
    outline: 2px solid ${(props) => props.theme.ui.accent};
    outline-offset: -2px;
  }
`
