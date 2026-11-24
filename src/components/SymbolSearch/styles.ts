import styled from 'styled-components'

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: rgba(0, 0, 0, 0.45);
`

export const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  width: 560px;
  max-width: calc(100vw - 32px);
  max-height: 70vh;
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 8px;
  box-shadow: 0 8px 28px ${(props) => props.theme.ui.shadow};
  overflow: hidden;
`

export const Input = styled.input`
  height: 52px;
  padding: 0 18px;
  background: transparent;
  border: none;
  border-bottom: 1px solid ${(props) => props.theme.ui.border};
  font-size: 16px;
  outline: none;

  &::placeholder {
    color: ${(props) => props.theme.ui.textMuted};
  }
`

export const Results = styled.ul`
  margin: 0;
  padding: 6px 0;
  list-style: none;
  overflow-y: auto;
`

export const Result = styled.li`
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  height: 40px;
  padding: 0 18px;
  cursor: pointer;

  &[aria-selected='true'] {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const ResultSymbol = styled.div`
  font-weight: 600;
`

export const ResultName = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const ResultExchange = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 12px;
`

export const Hint = styled.div`
  padding: 28px 18px;
  color: ${(props) => props.theme.ui.textMuted};
  text-align: center;
`
