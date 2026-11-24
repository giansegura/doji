import styled from 'styled-components'

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-top: 1px solid ${(props) => props.theme.ui.border};
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

export const Symbol = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-weight: 400;
`

export const Mark = styled.div`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(props) => props.theme.ui.accent};
`

export const Chevron = styled.div<{ $open: boolean }>`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 10px;
  transform: rotate(${(props) => (props.$open ? 180 : 0)}deg);
`

export const Text = styled.textarea`
  height: 150px;
  margin: 0 10px 10px;
  padding: 8px;
  resize: vertical;
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
  background: ${(props) => props.theme.ui.bg};
  color: ${(props) => props.theme.ui.text};
  font: inherit;
  line-height: 1.45;

  &:focus {
    border-color: ${(props) => props.theme.ui.accent};
    outline: none;
  }
`
