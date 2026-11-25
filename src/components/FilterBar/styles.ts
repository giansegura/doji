import styled from 'styled-components'

export const Bar = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 8px 6px 14px;
  font-size: 12px;
`

export const Trigger = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  border: 1px solid ${(props) => (props.$active ? props.theme.ui.accent : props.theme.ui.border)};
  border-radius: 12px;
  color: ${(props) => (props.$active ? props.theme.ui.text : props.theme.ui.textMuted)};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }
`

export const Name = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Count = styled.span`
  flex-shrink: 0;
  color: ${(props) => props.theme.ui.textMuted};
  font-variant-numeric: tabular-nums;
`

export const Spacer = styled.div`
  flex: 1;
`

export const Action = styled.button`
  flex-shrink: 0;
  height: 24px;
  padding: 0 6px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  white-space: nowrap;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }
`

export const Menu = styled.div`
  position: absolute;
  top: 28px;
  left: 14px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  padding: 6px;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
`

export const Item = styled.button`
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Scope = styled.span`
  color: ${(props) => props.theme.ui.textMuted};
`

export const Divider = styled.div`
  height: 1px;
  margin: 4px 0;
  background: ${(props) => props.theme.ui.separator};
`
