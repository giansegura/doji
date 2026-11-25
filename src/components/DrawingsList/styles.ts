import styled from 'styled-components'

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 300px;
  max-height: 60vh;
  font-size: 12px;
`

export const Title = styled.div`
  padding: 2px 4px;
  font-size: 13px;
  font-weight: 600;
`

export const Note = styled.div`
  padding: 2px 4px 6px;
  color: ${(props) => props.theme.ui.textMuted};
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
`

export const Item = styled.li<{ $hidden: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 4px;
  border-radius: 4px;
  opacity: ${(props) => (props.$hidden ? 0.5 : 1)};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Swatch = styled.span<{ $color: string }>`
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: ${(props) => props.$color};
`

export const Text = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`

export const Name = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Detail = styled.span`
  overflow: hidden;
  color: ${(props) => props.theme.ui.textMuted};
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Action = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};

  &:hover {
    background: ${(props) => props.theme.ui.border};
    color: ${(props) => props.theme.ui.text};
  }
`
