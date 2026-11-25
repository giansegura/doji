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

export const Group = styled.div`
  position: relative;
`

export const More = styled.button`
  position: absolute;
  right: -3px;
  bottom: 1px;
  width: 8px;
  height: 8px;
  border-right: 2px solid ${(props) => props.theme.ui.textMuted};
  border-bottom: 2px solid ${(props) => props.theme.ui.textMuted};
  opacity: 0.6;

  &:hover,
  &[aria-expanded='true'] {
    opacity: 1;
  }
`

export const Flyout = styled.div`
  position: absolute;
  top: 0;
  left: 42px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 180px;
  padding: 6px;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
`

export const FlyoutItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px 0 4px;
  border-radius: 4px;
  color: ${(props) => (props.$active ? props.theme.ui.accent : props.theme.ui.text)};
  font-size: 13px;
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`
