import styled from 'styled-components'

export const Bar = styled.nav`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  padding: 8px 0;
  background: ${(props) => props.theme.ui.panel};
`

export const ToolButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  color: ${(props) => (props.$active ? props.theme.ui.accent : props.theme.ui.text)};
  background: ${(props) => (props.$active ? props.theme.ui.hover : 'transparent')};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`
