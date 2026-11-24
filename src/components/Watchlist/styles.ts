import styled from 'styled-components'

const COLUMNS = 'minmax(0, 1fr) 76px 72px'

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 8px 0 14px;
`

export const Title = styled.div`
  font-size: 15px;
  font-weight: 600;
`

export const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  font-size: 20px;
  line-height: 1;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Columns = styled.div`
  display: grid;
  grid-template-columns: ${COLUMNS};
  gap: 4px;
  padding: 6px 30px 6px 14px;
  border-top: 1px solid ${(props) => props.theme.ui.border};
  border-bottom: 1px solid ${(props) => props.theme.ui.border};
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
`

export const ColumnLabel = styled.div<{ $right?: boolean }>`
  text-align: ${(props) => (props.$right ? 'right' : 'left')};
`

export const Rows = styled.ul`
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
`

export const RemoveButton = styled.button`
  position: absolute;
  top: 50%;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  transform: translateY(-50%);
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 16px;
  line-height: 1;
  opacity: 0;

  &:hover {
    background: ${(props) => props.theme.ui.border};
    color: ${(props) => props.theme.ui.text};
  }

  &:focus-visible {
    opacity: 1;
  }
`

export const Row = styled.li<{ $dragging: boolean }>`
  position: relative;
  opacity: ${(props) => (props.$dragging ? 0.4 : 1)};

  &:hover ${RemoveButton} {
    opacity: 1;
  }
`

export const RowButton = styled.button`
  display: grid;
  grid-template-columns: ${COLUMNS};
  gap: 4px;
  align-items: center;
  width: 100%;
  height: 36px;
  padding: 0 30px 0 14px;
  text-align: left;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }

  &[aria-current='true'] {
    background: ${(props) => props.theme.ui.active};
  }
`

export const Symbol = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const Ticker = styled.div`
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Number = styled.div<{ $color?: string }>`
  color: ${(props) => props.$color ?? 'inherit'};
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
`

export const Empty = styled.div`
  padding: 24px 14px;
  color: ${(props) => props.theme.ui.textMuted};
  text-align: center;
`
