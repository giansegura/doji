import styled from 'styled-components'

export const Bar = styled.div`
  position: absolute;
  bottom: 44px;
  left: 50%;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 8px;
  transform: translateX(-50%);
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.accent};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
  white-space: nowrap;
`

export const Message = styled.span`
  padding: 0 6px;
  font-size: 13px;
`

export const Button = styled.button`
  height: 28px;
  padding: 0 10px;
  border-radius: 4px;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Speed = styled.select`
  height: 28px;
  padding: 0 6px;
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
`
