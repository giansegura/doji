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

export const Name = styled.div`
  margin-bottom: 6px;
  font-weight: 600;
`

export const Rows = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0 0 8px;
  font-size: 12px;
`

export const Term = styled.dt`
  color: ${(props) => props.theme.ui.textMuted};
`

export const Value = styled.dd`
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
`

export const Summary = styled.p`
  display: -webkit-box;
  margin: 0 0 6px;
  overflow: hidden;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
`

export const Site = styled.a`
  color: ${(props) => props.theme.ui.accent};
  font-size: 12px;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

export const Note = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 12px;
`

export const Row = styled.div`
  display: contents;
`
