import styled from 'styled-components'

export const Stack = styled.div`
  position: absolute;
  left: 12px;
  bottom: 40px;
  z-index: 8;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: calc(100% - 80px);
  overflow-y: auto;
`

export const Toast = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 12px;
  border: 1px solid ${(props) => props.theme.ui.accent};
  border-radius: 6px;
  background: ${(props) => props.theme.ui.panel};
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
`

export const Time = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-variant-numeric: tabular-nums;
`

export const Close = styled.button`
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 16px;
  line-height: 1;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }
`
