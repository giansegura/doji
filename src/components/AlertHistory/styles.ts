import styled from 'styled-components'

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 280px;
  margin-top: 6px;
  padding: 8px 4px 2px;
  border-top: 1px solid ${(props) => props.theme.ui.border};
  font-size: 13px;
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

export const Title = styled.div`
  font-weight: 600;
`

export const Clear = styled.button`
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 12px;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }
`

export const Note = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 12px;
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  max-height: 240px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
`

export const Entry = styled.button`
  display: grid;
  grid-template-columns: 82px 58px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  min-height: 26px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 12px;
  text-align: left;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const When = styled.span`
  color: ${(props) => props.theme.ui.textMuted};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

export const Code = styled.span`
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const What = styled.span`
  overflow: hidden;
  color: ${(props) => props.theme.ui.text};
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Arrow = styled.span<{ $color: string }>`
  color: ${(props) => props.$color};
`

export const Price = styled.span`
  font-variant-numeric: tabular-nums;
`
