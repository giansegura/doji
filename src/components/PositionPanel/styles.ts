import styled from 'styled-components'

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-top: ${(props) => props.theme.ui.gap}px solid ${(props) => props.theme.ui.separator};
`

export const Toggle = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px;
  text-align: left;
  font-weight: 600;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Label = styled.div`
  flex: 1;
`

export const Gain = styled.div<{ $color: string }>`
  color: ${(props) => props.$color};
  font-weight: 400;
  font-variant-numeric: tabular-nums;
`

export const Muted = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-weight: 400;
`

export const Chevron = styled.div<{ $open: boolean }>`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 10px;
  transform: rotate(${(props) => (props.$open ? 180 : 0)}deg);
`

export const Form = styled.form`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  align-items: end;
  padding: 0 10px 10px;
`

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
`

export const Input = styled.input`
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
  background: ${(props) => props.theme.ui.bg};
  color: ${(props) => props.theme.ui.text};
  font: inherit;

  &:focus {
    border-color: ${(props) => props.theme.ui.accent};
    outline: none;
  }
`

export const Remove = styled.button`
  grid-column: 1 / -1;
  justify-self: end;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  white-space: nowrap;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.down};
  }
`
