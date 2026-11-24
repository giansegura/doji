import styled from 'styled-components'

export const Group = styled.div`
  position: absolute;
  top: 6px;
  right: 76px;
  z-index: 4;
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
  background: ${(props) => props.theme.ui.panel};
`

export const Option = styled.button<{ $active: boolean }>`
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  color: ${(props) => (props.$active ? props.theme.ui.accent : props.theme.ui.text)};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`
