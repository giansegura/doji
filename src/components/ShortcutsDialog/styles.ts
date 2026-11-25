import styled from 'styled-components'

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  background: rgba(0, 0, 0, 0.45);
`

export const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 520px;
  max-width: calc(100vw - 32px);
  max-height: 80vh;
  padding: 16px;
  overflow-y: auto;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 8px;
  box-shadow: 0 8px 28px ${(props) => props.theme.ui.shadow};
`

export const Title = styled.div`
  font-size: 16px;
  font-weight: 600;
`

export const Groups = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const Group = styled.section`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

export const GroupTitle = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
`

export const Keys = styled.td`
  width: 190px;
  padding: 3px 12px 3px 0;
  vertical-align: top;
  white-space: nowrap;

  kbd {
    padding: 1px 6px;
    border: 1px solid ${(props) => props.theme.ui.border};
    border-radius: 4px;
    background: ${(props) => props.theme.ui.panel};
    color: ${(props) => props.theme.ui.text};
    font-family: inherit;
    font-size: 12px;
  }
`

export const What = styled.td`
  padding: 3px 0;
  color: ${(props) => props.theme.ui.text};
`

export const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const Button = styled.button`
  height: 30px;
  padding: 0 14px;
  border-radius: 6px;
  background: ${(props) => props.theme.ui.accent};
  color: ${(props) => props.theme.ui.onAccent};
`
