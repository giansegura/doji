import styled from 'styled-components'

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  max-height: 45vh;
  border-top: ${(props) => props.theme.ui.gap}px solid ${(props) => props.theme.ui.separator};
`

export const Toggle = styled.button`
  display: flex;
  flex-shrink: 0;
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

export const Muted = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-weight: 400;
`

export const Chevron = styled.div<{ $open: boolean }>`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 10px;
  transform: rotate(${(props) => (props.$open ? 180 : 0)}deg);
`

export const Body = styled.div`
  overflow-y: auto;
  padding: 0 14px 12px;
`

export const Note = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 12px;
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Headline = styled.a`
  display: block;
  color: ${(props) => props.theme.ui.text};
  font-size: 13px;
  line-height: 1.35;
  text-decoration: none;

  &:hover {
    color: ${(props) => props.theme.ui.accent};
  }
`

export const Meta = styled.div`
  margin-top: 2px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
`
