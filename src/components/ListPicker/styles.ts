import styled from 'styled-components'

export const Root = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
`

export const Trigger = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 30px;
  padding: 0 8px;
  margin-left: -8px;
  border-radius: 4px;
  font-size: 15px;
  font-weight: 600;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const TriggerName = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Menu = styled.div`
  position: absolute;
  top: 34px;
  left: -8px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 280px;
  max-height: 60vh;
  padding: 6px;
  overflow-y: auto;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
`

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 32px;
`

export const Item = styled.button`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border-radius: 4px;
  text-align: left;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }

  &[aria-current='true'] {
    color: ${(props) => props.theme.ui.accent};
    font-weight: 600;
  }
`

export const ItemName = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const IconButton = styled.button`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`

export const Input = styled.input`
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  background: ${(props) => props.theme.ui.bg};
  border: 1px solid ${(props) => props.theme.ui.accent};
  border-radius: 4px;
  outline: none;
`

export const Question = styled.div`
  flex: 1;
  min-width: 0;
  padding: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const TextButton = styled.button<{ $danger?: boolean }>`
  flex-shrink: 0;
  height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  color: ${(props) => (props.$danger ? props.theme.ui.down : props.theme.ui.textMuted)};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Footer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid ${(props) => props.theme.ui.border};
`

export const CreateButton = styled.button`
  flex: 1;
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.accent};
  text-align: left;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }

  &:disabled {
    color: ${(props) => props.theme.ui.textMuted};
    cursor: default;
  }
`
